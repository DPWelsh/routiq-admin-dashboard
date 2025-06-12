import { logger } from '../../logging/logger'

// Database row interfaces - Updated to match actual schema
interface ActivePatientRow {
  id: number
  cliniko_patient_id: string
  name: string
  email: string | null
  phone: string | null
  recent_appointment_count: number
  upcoming_appointment_count: number
  total_appointment_count: number
  last_appointment_date: string | null
  recent_appointments: unknown[] | null
  upcoming_appointments: unknown[] | null
  search_date_from: string
  search_date_to: string
  created_at: string
  updated_at: string
}

// Enhanced churn analysis types
export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type PatientSegment = 'new' | 'active' | 'at_risk' | 'dormant' | 'churned' | 'completed'
export type RebookingPriority = 'high' | 'medium' | 'low'

// TypeScript interfaces for Active Patients data - Updated to match actual schema
export interface ActivePatient {
  id: number
  cliniko_patient_id: string
  name: string
  email: string
  phone: string
  recent_appointment_count: number
  upcoming_appointment_count: number
  total_appointment_count: number
  last_appointment_date: Date | null
  recent_appointments: unknown[]
  upcoming_appointments: unknown[]
  search_date_from: Date
  search_date_to: Date
  created_at: Date
  updated_at: Date
  // Computed churn analysis fields
  churn_risk?: ChurnRiskLevel
  patient_segment?: PatientSegment
  rebooking_priority?: RebookingPriority
  days_since_last_appointment?: number | null
  treatment_momentum?: 'building' | 'maintaining' | 'declining' | 'stalled'
}

export interface ActivePatientsStats {
  total_patients: number
  patients_with_recent_appointments: number
  patients_with_upcoming_appointments: number
  patients_without_recent_appointments: number
  churn_analysis: {
    at_risk_patients: number
    dormant_patients: number
    churned_patients: number
    completed_treatment: number
  }
  rebooking_priorities: {
    high: number
    medium: number
    low: number
  }
  treatment_momentum: {
    building: number
    maintaining: number
    declining: number
    stalled: number
  }
  recent_appointment_distribution: Array<{
    count: number
    patients: number
  }>
}

// Connection to database (using same connection as Chatwoot)
const createDbClient = () => {
  const connectionString = process.env.CHATWOOT_DATABASE_URL || process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error('Database connection failed: Neither CHATWOOT_DATABASE_URL nor DATABASE_URL environment variable is set.')
  }
  
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('pg')
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
}

export class ActivePatientsDataAccess {
  private async executeQuery<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
    const client = createDbClient()
    
    try {
      await client.connect()
      logger.info('Executing active patients query', { query: query.substring(0, 100) + '...' })
      const result = await client.query(query, params)
      logger.info('Query executed successfully', { rowCount: result.rows.length })
      return result.rows
    } catch (error) {
      logger.error('Database query failed', { error, query: query.substring(0, 100) + '...' })
      throw error
    } finally {
      await client.end()
    }
  }

  private analyzeChurnRisk(patient: ActivePatientRow): {
    churn_risk: ChurnRiskLevel
    patient_segment: PatientSegment
    rebooking_priority: RebookingPriority
    days_since_last_appointment: number | null
    treatment_momentum: 'building' | 'maintaining' | 'declining' | 'stalled'
  } {
    const now = new Date()
    const lastAppointment = patient.last_appointment_date ? new Date(patient.last_appointment_date) : null
    const daysSinceLastAppointment = lastAppointment 
      ? Math.floor((now.getTime() - lastAppointment.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Analyze treatment momentum based on appointment patterns
    let treatment_momentum: 'building' | 'maintaining' | 'declining' | 'stalled' = 'stalled'
    if (patient.recent_appointment_count >= 3 && patient.upcoming_appointment_count > 0) {
      treatment_momentum = 'building'
    } else if (patient.recent_appointment_count >= 2 && patient.upcoming_appointment_count > 0) {
      treatment_momentum = 'maintaining'
    } else if (patient.recent_appointment_count > 0 && patient.upcoming_appointment_count === 0) {
      treatment_momentum = 'declining'
    }

    // IMPROVED: Healthcare-appropriate patient segment logic
    let patient_segment: PatientSegment = 'new'
    if (daysSinceLastAppointment === null) {
      patient_segment = 'new'
    } else if (daysSinceLastAppointment < 0) {
      // Future appointments - these are active patients with future care planned
      patient_segment = 'active'
    } else if (daysSinceLastAppointment <= 14) {
      // Within 2 weeks - still active
      patient_segment = 'active'
    } else if (daysSinceLastAppointment <= 30) {
      // 2-4 weeks - becoming at risk
      patient_segment = 'at_risk'
    } else if (daysSinceLastAppointment <= 60) {
      // 4-8 weeks - dormant but recoverable
      patient_segment = 'dormant'
    } else {
      // 8+ weeks - likely churned
      patient_segment = 'churned'
    }
    
    // Handle completed treatment case - patients who had sufficient treatment and graduated
    if (patient.total_appointment_count >= 8 && daysSinceLastAppointment && daysSinceLastAppointment > 30 && daysSinceLastAppointment < 90) {
      patient_segment = 'completed'
    }

    // SIMPLIFIED: Healthcare-focused rebooking priority
    let rebooking_priority: RebookingPriority = 'low'
    
    // Enhanced rule with time factor:
    // 1. High priority: 30+ days since last appointment (urgent attention needed)
    // 2. Medium priority: No upcoming appointments but recent activity (needs rebooking)
    // 3. Low priority: Has upcoming appointments (already scheduled)
    
    if (daysSinceLastAppointment !== null && daysSinceLastAppointment >= 30) {
      // High priority: 30+ days since last appointment - urgent attention needed
      rebooking_priority = 'high'
    } else if (patient.upcoming_appointment_count === 0) {
      // Medium priority: No upcoming appointments but recent activity
      rebooking_priority = 'medium'
    } else {
      // Low priority: Has upcoming appointments
      rebooking_priority = 'low'
    }

    // SIMPLIFIED: Churn risk based on appointment gaps and engagement
    let churn_risk: ChurnRiskLevel = 'low'
    
    if (daysSinceLastAppointment === null) {
      // New patients need attention
      churn_risk = 'medium'
    } else if (daysSinceLastAppointment < 0 || daysSinceLastAppointment <= 14) {
      // Recent appointments or upcoming appointments
      churn_risk = 'low'
    } else if (daysSinceLastAppointment <= 30) {
      // 2-4 weeks gap
        churn_risk = 'medium'
    } else {
      // 4+ weeks gap - high risk
        churn_risk = 'high'
    }

    return {
      churn_risk,
      patient_segment,
      rebooking_priority,
      days_since_last_appointment: daysSinceLastAppointment,
      treatment_momentum
    }
  }

  private convertRowToActivePatient(row: ActivePatientRow): ActivePatient {
    const churnAnalysis = this.analyzeChurnRisk(row)
    
    return {
      id: row.id,
      cliniko_patient_id: row.cliniko_patient_id,
      name: row.name,
      email: row.email || '',
      phone: row.phone || '',
      recent_appointment_count: row.recent_appointment_count,
      upcoming_appointment_count: row.upcoming_appointment_count,
      total_appointment_count: row.total_appointment_count,
      last_appointment_date: row.last_appointment_date ? new Date(row.last_appointment_date) : null,
      recent_appointments: row.recent_appointments || [],
      upcoming_appointments: row.upcoming_appointments || [],
      search_date_from: new Date(row.search_date_from),
      search_date_to: new Date(row.search_date_to),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      ...churnAnalysis
    }
  }

  async getActivePatients(filter?: string, limit?: number, organizationId?: string): Promise<ActivePatient[]> {
    try {
      let query = `
        SELECT 
          id,
          cliniko_patient_id,
          name,
          email,
          phone,
          recent_appointment_count,
          upcoming_appointment_count,
          total_appointment_count,
          last_appointment_date,
          recent_appointments,
          upcoming_appointments,
          search_date_from,
          search_date_to,
          created_at,
          updated_at
        FROM active_patients
      `
      
      const params: unknown[] = []
      
      // Always filter by organization if provided
      let hasWhere = false
      if (organizationId) {
        query += ` WHERE organization_id = $${params.length + 1}`
        params.push(organizationId)
        hasWhere = true
      }
      
      // Simplified filtering for healthcare-focused priority system
      if (filter && filter !== 'all') {
        const connector = hasWhere ? ' AND' : ' WHERE'
        
        switch (filter) {
          case 'high':
            // High risk patients: 4+ weeks since last appointment
            query += `${connector} last_appointment_date < NOW() - INTERVAL '30 days'`
            break
          case 'medium':
            // Medium priority: No upcoming appointments OR new patients OR 2-4 weeks gap
            query += `${connector} (
                        upcoming_appointment_count = 0
                        OR last_appointment_date IS NULL
                        OR (last_appointment_date BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '14 days')
                      )`
            break
          case 'low':
            // Low priority: Has upcoming appointments AND recent activity
            query += `${connector} upcoming_appointment_count > 0 
                       AND (last_appointment_date IS NULL OR last_appointment_date > NOW() - INTERVAL '14 days')`
            break
          // Keep legacy filters for backward compatibility during transition
          case 'recent':
            query += `${connector} recent_appointment_count > 0`
            break
          case 'upcoming':
            query += `${connector} upcoming_appointment_count > 0`
            break
          case 'inactive':
            query += `${connector} recent_appointment_count = 0 AND upcoming_appointment_count = 0`
            break
          case 'active':
            query += `${connector} recent_appointment_count > 0 OR upcoming_appointment_count > 0`
            break
          case 'at_risk':
            // Patients becoming at risk: 2-4 weeks since last appointment
            query += `${connector} last_appointment_date BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '14 days'`
            break
          case 'dormant':
            // Patients dormant but recoverable: 4-8 weeks
            query += `${connector} last_appointment_date BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'`
            break
          case 'churned':
            // Patients likely lost: 8+ weeks
            query += `${connector} last_appointment_date < NOW() - INTERVAL '60 days'`
            break
          case 'high_value_at_risk':
            // Established patients (3+ appointments) who are now at risk
            query += `${connector} total_appointment_count >= 3 
                      AND recent_appointment_count = 0 
                      AND upcoming_appointment_count = 0
                      AND last_appointment_date BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '14 days'`
            break
          case 'immediate_rebooking':
            // Patients needing immediate rebooking attention
            query += `${connector} (
                        (last_appointment_date BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '14 days' AND upcoming_appointment_count = 0)
                        OR (total_appointment_count >= 3 AND recent_appointment_count = 0 AND last_appointment_date <= NOW() - INTERVAL '14 days')
                      )`
            break
          case 'treatment_building':
            // Patients with strong momentum (3+ recent, upcoming scheduled)
            query += `${connector} recent_appointment_count >= 3 AND upcoming_appointment_count > 0`
            break
          case 'treatment_declining':
            // Patients with declining momentum (recent appointments but no upcoming)
            query += `${connector} recent_appointment_count > 0 AND upcoming_appointment_count = 0`
            break
        }
      }
      
      query += ` ORDER BY 
        CASE 
          WHEN (upcoming_appointment_count = 0 AND last_appointment_date BETWEEN NOW() - INTERVAL '45 days' AND NOW() - INTERVAL '21 days')
            OR (total_appointment_count >= 5 AND recent_appointment_count = 0 AND last_appointment_date > NOW() - INTERVAL '90 days')
            OR (recent_appointment_count = 0 AND last_appointment_date BETWEEN NOW() - INTERVAL '21 days' AND NOW()) THEN 1
          WHEN recent_appointment_count = 0 THEN 2
          WHEN upcoming_appointment_count = 0 THEN 3
          ELSE 4
        END,
        last_appointment_date DESC NULLS LAST, 
        recent_appointment_count DESC`
      
      if (limit) {
        query += ` LIMIT $${params.length + 1}`
        params.push(limit)
      }

      const rows = await this.executeQuery<ActivePatientRow>(query, params)
      return rows.map(row => this.convertRowToActivePatient(row))
    } catch (error) {
      logger.error('Failed to fetch active patients', { error })
      throw error
    }
  }

  async getActivePatientById(id: number): Promise<ActivePatient | null> {
    try {
      const query = `
        SELECT 
          id,
          cliniko_patient_id,
          name,
          email,
          phone,
          recent_appointment_count,
          upcoming_appointment_count,
          total_appointment_count,
          last_appointment_date,
          recent_appointments,
          upcoming_appointments,
          search_date_from,
          search_date_to,
          created_at,
          updated_at
        FROM active_patients
        WHERE id = $1
      `
      
      const rows = await this.executeQuery<ActivePatientRow>(query, [id])
      return rows.length > 0 ? this.convertRowToActivePatient(rows[0]) : null
    } catch (error) {
      logger.error('Failed to fetch active patient by ID', { error, id })
      throw error
    }
  }

  async getActivePatientByClinikoId(clinikoPatientId: string): Promise<ActivePatient | null> {
    try {
      const query = `
        SELECT 
          id,
          cliniko_patient_id,
          name,
          email,
          phone,
          recent_appointment_count,
          upcoming_appointment_count,
          total_appointment_count,
          last_appointment_date,
          recent_appointments,
          upcoming_appointments,
          search_date_from,
          search_date_to,
          created_at,
          updated_at
        FROM active_patients
        WHERE cliniko_patient_id = $1
      `
      
      const rows = await this.executeQuery<ActivePatientRow>(query, [clinikoPatientId])
      return rows.length > 0 ? this.convertRowToActivePatient(rows[0]) : null
    } catch (error) {
      logger.error('Failed to fetch active patient by Cliniko ID', { error, clinikoPatientId })
      throw error
    }
  }

  async getActivePatientsStats(): Promise<ActivePatientsStats> {
    try {
      // CRITICAL OPTIMIZATION: Use direct SQL aggregations with improved healthcare logic
      const statsQuery = `
        WITH churn_analysis AS (
          SELECT 
            CASE 
              -- New patients with no appointment history
              WHEN last_appointment_date IS NULL THEN 'new'
              -- Future appointments - active patients with upcoming care
              WHEN last_appointment_date > NOW() THEN 'active'
              -- Within 2 weeks - still active
              WHEN last_appointment_date > NOW() - INTERVAL '14 days' THEN 'active'
              -- 2-4 weeks - becoming at risk
              WHEN last_appointment_date > NOW() - INTERVAL '30 days' THEN 'at_risk'
              -- 4-8 weeks - dormant but recoverable
              WHEN last_appointment_date > NOW() - INTERVAL '60 days' THEN 'dormant'
              -- 8+ weeks - likely churned
              ELSE 'churned'
            END as segment,
            CASE 
              -- High risk: 4+ weeks since last appointment  
              WHEN last_appointment_date < NOW() - INTERVAL '30 days' THEN 'high'
              -- Medium priority: No upcoming appointment (simple rule)
              WHEN upcoming_appointment_count = 0 THEN 'medium'
              -- Low priority: Has upcoming appointments
              ELSE 'low'
            END as priority,
            CASE 
              WHEN recent_appointment_count >= 3 AND upcoming_appointment_count > 0 THEN 'building'
              WHEN recent_appointment_count > 0 AND upcoming_appointment_count > 0 THEN 'maintaining'
              WHEN recent_appointment_count > 0 AND upcoming_appointment_count = 0 THEN 'declining'
              ELSE 'stalled'
            END as momentum,
            -- Calculate days since last appointment for risk assessment
            CASE 
              WHEN last_appointment_date IS NULL THEN NULL
              ELSE EXTRACT(days FROM (NOW() - last_appointment_date))
            END as days_since_last
          FROM active_patients
        ),
        risk_analysis AS (
          SELECT 
            segment,
            priority,
            momentum,
            days_since_last,
            upcoming_appointment_count > 0 as has_upcoming,
            recent_appointment_count > 0 as has_recent,
            total_appointment_count >= 3 as is_established,
            CASE
              -- New patients need attention but aren't high risk yet
              WHEN days_since_last IS NULL THEN 'medium'
              -- Active patients with upcoming care or recent appointments
              WHEN days_since_last < 0 OR (days_since_last <= 14 AND upcoming_appointment_count > 0) THEN 'low'
              -- 2-4 weeks gap - medium risk, especially if no upcoming appointments
              WHEN days_since_last <= 30 THEN 
                CASE WHEN upcoming_appointment_count > 0 THEN 'low' ELSE 'medium' END
              -- 4-8 weeks gap - high risk unless completed treatment
              WHEN days_since_last <= 60 THEN 
                CASE WHEN segment = 'completed' THEN 'medium' ELSE 'high' END
              -- 8+ weeks - critical risk
              ELSE 'high'
            END as churn_risk
          FROM churn_analysis
        ),
        stats AS (
          SELECT 
            COUNT(*) as total_patients,
            COUNT(CASE WHEN recent_appointment_count > 0 THEN 1 END) as patients_with_recent_appointments,
            COUNT(CASE WHEN upcoming_appointment_count > 0 THEN 1 END) as patients_with_upcoming_appointments,
            COUNT(CASE WHEN recent_appointment_count = 0 THEN 1 END) as patients_without_recent_appointments
          FROM active_patients
        ),
        segment_counts AS (
          SELECT 
            COUNT(CASE WHEN segment = 'at_risk' THEN 1 END) as at_risk_patients,
            COUNT(CASE WHEN segment = 'dormant' THEN 1 END) as dormant_patients,
            COUNT(CASE WHEN segment = 'churned' THEN 1 END) as churned_patients,
            COUNT(CASE WHEN segment = 'completed' THEN 1 END) as completed_treatment
          FROM risk_analysis
        ),
        priority_counts AS (
          SELECT 
            COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
            COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium,
            COUNT(CASE WHEN priority = 'low' THEN 1 END) as low
          FROM risk_analysis
        ),
        momentum_counts AS (
          SELECT 
            COUNT(CASE WHEN momentum = 'building' THEN 1 END) as building,
            COUNT(CASE WHEN momentum = 'maintaining' THEN 1 END) as maintaining,
            COUNT(CASE WHEN momentum = 'declining' THEN 1 END) as declining,
            COUNT(CASE WHEN momentum = 'stalled' THEN 1 END) as stalled
          FROM risk_analysis
        )
        SELECT 
          s.*,
          sc.*,
          pc.*,
          mc.*
        FROM stats s, segment_counts sc, priority_counts pc, momentum_counts mc
      `

      const [statsResult] = await this.executeQuery<{
        total_patients: string
        patients_with_recent_appointments: string
        patients_with_upcoming_appointments: string
        patients_without_recent_appointments: string
        at_risk_patients: string
        dormant_patients: string
        churned_patients: string
        completed_treatment: string
        high: string
        medium: string
        low: string
        building: string
        maintaining: string
        declining: string
        stalled: string
      }>(statsQuery)

      // Get distribution efficiently
      const distributionQuery = `
        SELECT 
          recent_appointment_count as count,
          COUNT(*) as patients
        FROM active_patients
        GROUP BY recent_appointment_count
        ORDER BY recent_appointment_count DESC
      `
      const distributionRows = await this.executeQuery<{
        count: number
        patients: string
      }>(distributionQuery)

      const recent_appointment_distribution = distributionRows.map(row => ({
        count: row.count,
        patients: parseInt(row.patients)
      }))

      return {
        total_patients: parseInt(statsResult.total_patients),
        patients_with_recent_appointments: parseInt(statsResult.patients_with_recent_appointments),
        patients_with_upcoming_appointments: parseInt(statsResult.patients_with_upcoming_appointments),
        patients_without_recent_appointments: parseInt(statsResult.patients_without_recent_appointments),
        churn_analysis: {
          at_risk_patients: parseInt(statsResult.at_risk_patients),
          dormant_patients: parseInt(statsResult.dormant_patients),
          churned_patients: parseInt(statsResult.churned_patients),
          completed_treatment: parseInt(statsResult.completed_treatment)
        },
        rebooking_priorities: {
          high: parseInt(statsResult.high),
          medium: parseInt(statsResult.medium),
          low: parseInt(statsResult.low)
        },
        treatment_momentum: {
          building: parseInt(statsResult.building),
          maintaining: parseInt(statsResult.maintaining),
          declining: parseInt(statsResult.declining),
          stalled: parseInt(statsResult.stalled)
        },
        recent_appointment_distribution
      }
    } catch (error) {
      logger.error('Failed to fetch active patients stats', { error })
      throw error
    }
  }

  // Note: The original schema doesn't have a status field, so we'll work with appointment counts instead
  async updatePatientNotes(id: number, _: string): Promise<ActivePatient | null> {
    try {
      // Since there's no notes field in the schema, we'll just return the patient as-is
      // This method is kept for API compatibility but doesn't actually update anything
      return await this.getActivePatientById(id)
    } catch (error) {
      logger.error('Failed to update patient notes', { error, id })
      throw error
    }
  }

  async refreshPatientData(id: number): Promise<ActivePatient | null> {
    try {
      // Update the updated_at timestamp to mark as refreshed
      const query = `
        UPDATE active_patients 
        SET updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      
      const rows = await this.executeQuery<ActivePatientRow>(query, [id])
      return rows.length > 0 ? this.convertRowToActivePatient(rows[0]) : null
    } catch (error) {
      logger.error('Failed to refresh patient data', { error, id })
      throw error
    }
  }
}

// Convenience functions - Updated parameter names
export async function getActivePatients(filter?: string, limit?: number, organizationId?: string): Promise<ActivePatient[]> {
  const dataAccess = new ActivePatientsDataAccess()
  return dataAccess.getActivePatients(filter, limit, organizationId)
}

export async function getActivePatientById(id: number): Promise<ActivePatient | null> {
  const dataAccess = new ActivePatientsDataAccess()
  return dataAccess.getActivePatientById(id)
}

export async function getActivePatientByClinikoId(clinikoPatientId: string): Promise<ActivePatient | null> {
  const dataAccess = new ActivePatientsDataAccess()
  return dataAccess.getActivePatientByClinikoId(clinikoPatientId)
}

export async function getActivePatientsStats(): Promise<ActivePatientsStats> {
  const dataAccess = new ActivePatientsDataAccess()
  return dataAccess.getActivePatientsStats()
}

export async function updatePatientNotes(id: number, _: string): Promise<ActivePatient | null> {
  const dataAccess = new ActivePatientsDataAccess()
  return dataAccess.updatePatientNotes(id, _)
}

export async function refreshPatientData(id: number): Promise<ActivePatient | null> {
  const dataAccess = new ActivePatientsDataAccess()
  return dataAccess.refreshPatientData(id)
} 