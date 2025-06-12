/**
 * Example API endpoint with RBAC integration
 * Task #7: Create Role-Based Access Control - API Integration Example
 */

import { NextRequest } from 'next/server'
import { requirePatientAccess } from '@/lib/rbac/rbac-middleware'
import { createOrganizationFilter } from '@/lib/auth/request-context'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/patients - View patients (requires PATIENTS_VIEW permission)
export const GET = requirePatientAccess('view')(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    // Create organization filter to ensure data isolation
    const orgFilter = createOrganizationFilter(context)

    // Build where clause with organization scoping
    const whereClause = {
      ...orgFilter,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ]
      })
    }

    // Fetch patients with pagination
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where: whereClause,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        }
      }),
      prisma.patient.count({ where: whereClause })
    ])

    return new Response(
      JSON.stringify({
        patients,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        organizationContext: {
          organizationId: context.organizationId,
          organizationName: context.organizationName,
          userRole: context.userRole
        }
      }),
      { 
        status: 200,
        headers: { 'content-type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error fetching patients:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch patients',
        code: 'FETCH_PATIENTS_ERROR'
      }),
      { 
        status: 500,
        headers: { 'content-type': 'application/json' } 
      }
    )
  }
})

// POST /api/patients - Create patient (requires PATIENTS_CREATE permission)
export const POST = requirePatientAccess('create')(async (context, request: NextRequest) => {
  try {
    const body = await request.json()
    const { name, email, phone } = body

    // Validate required fields
    if (!name || !phone) {
      return new Response(
        JSON.stringify({ 
          error: 'Name and phone are required',
          code: 'VALIDATION_ERROR'
        }),
        { 
          status: 400,
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    // Create patient with organization context
    const patient = await prisma.patient.create({
      data: {
        name,
        email,
        phone,
        organizationId: context.organizationId, // Automatically scoped to user's organization
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      }
    })

    return new Response(
      JSON.stringify({
        patient,
        message: 'Patient created successfully',
        organizationContext: {
          organizationId: context.organizationId,
          organizationName: context.organizationName,
          userRole: context.userRole
        }
      }),
      { 
        status: 201,
        headers: { 'content-type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error creating patient:', error)
    
    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return new Response(
        JSON.stringify({ 
          error: 'Patient with this phone number already exists in your organization',
          code: 'DUPLICATE_PATIENT'
        }),
        { 
          status: 409,
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        error: 'Failed to create patient',
        code: 'CREATE_PATIENT_ERROR'
      }),
      { 
        status: 500,
        headers: { 'content-type': 'application/json' } 
      }
    )
  }
}) 