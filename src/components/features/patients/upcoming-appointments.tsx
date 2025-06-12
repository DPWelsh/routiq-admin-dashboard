'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, Clock, Phone, Mail, MoreHorizontal, RefreshCw, User, AlertCircle, CheckCircle2 } from 'lucide-react'
import { BlurFade, NumberTicker } from '@/components/magicui'
import { cn } from '@/lib/utils'

interface UpcomingAppointment {
  id: string
  date: string
  type: string
}

interface PatientWithUpcoming {
  id: number
  contact_id: string
  contact_name: string
  contact_phone: string
  upcoming_appointment_count: number
  upcoming_appointments: string | UpcomingAppointment[]
  recent_appointment_count: number
  total_appointment_count: number
  last_appointment_date: string | null
  created_at: string
  updated_at: string
}

interface UpcomingAppointmentsResponse {
  patients: PatientWithUpcoming[]
  total_count: number
  organization_id: string
  timestamp: string
  message?: string
}

interface UpcomingAppointmentsProps {
  /** Optional limit for number of patients to show */
  limit?: number
  /** Whether to show the refresh button */
  showRefresh?: boolean
  /** Whether to show full patient details or compact view */
  compact?: boolean
  /** Callback when a patient is clicked */
  onPatientClick?: (patient: PatientWithUpcoming) => void
  /** Custom title for the component */
  title?: string
}

export function UpcomingAppointments({ 
  limit = 10, 
  showRefresh = true, 
  compact = false,
  onPatientClick,
  title = "Upcoming Appointments"
}: UpcomingAppointmentsProps) {
  const [data, setData] = useState<UpcomingAppointmentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUpcomingAppointments = useCallback(async () => {
    try {
      const response = await fetch(`/api/active-patients/upcoming?limit=${limit}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch upcoming appointments: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (error) {
      console.error('Error fetching upcoming appointments:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
      setData(null)
    }
  }, [limit])

  const handleRefresh = async () => {
    if (refreshing || loading) return
    
    try {
      setRefreshing(true)
      await fetchUpcomingAppointments()
    } catch (error) {
      console.error('Error refreshing upcoming appointments:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handlePatientClick = (patient: PatientWithUpcoming) => {
    if (onPatientClick) {
      onPatientClick(patient)
    }
  }

  const handleCallPatient = (phone: string) => {
    if (phone) {
      window.open(`tel:${phone}`, '_self')
    }
  }

  const handleEmailPatient = (email: string) => {
    if (email) {
      window.open(`mailto:${email}`, '_self')
    }
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = date.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        return `Today at ${date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}`
      } else if (diffDays === 1) {
        return `Tomorrow at ${date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}`
      } else if (diffDays <= 7) {
        return `${date.toLocaleDateString('en-US', { 
          weekday: 'long' 
        })} at ${date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}`
      } else {
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      }
    } catch (error) {
      return dateString
    }
  }

  const formatPhoneNumber = (phone: string): string => {
    // Simple phone formatting - can be enhanced
    if (phone.startsWith('+1')) {
      const digits = phone.slice(2)
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      }
    }
    return phone
  }

  const parseUpcomingAppointments = (appointments: string | UpcomingAppointment[]): UpcomingAppointment[] => {
    if (typeof appointments === 'string') {
      try {
        return JSON.parse(appointments)
      } catch {
        return []
      }
    }
    return appointments || []
  }

  const getNextAppointment = (patient: PatientWithUpcoming): UpcomingAppointment | null => {
    const appointments = parseUpcomingAppointments(patient.upcoming_appointments)
    if (appointments.length === 0) return null
    
    // Sort by date and return the earliest
    return appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchUpcomingAppointments()
      setLoading(false)
    }
    
    loadData()
  }, [fetchUpcomingAppointments])

  if (loading) {
    return (
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading upcoming appointments...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-white border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <span className="ml-2 text-red-600">{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const patients = data?.patients || []
  const hasMessage = data?.message

  return (
    <BlurFade delay={0.1}>
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              {title}
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                <NumberTicker value={data?.total_count || 0} />
              </Badge>
            </CardTitle>
            {showRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {hasMessage && patients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              <span className="ml-2 text-amber-600">{hasMessage}</span>
            </div>
          ) : patients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="ml-2 text-gray-500">No upcoming appointments</span>
            </div>
          ) : (
            <div className="space-y-3">
              {patients.map((patient) => {
                const nextAppointment = getNextAppointment(patient)
                
                return (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => handlePatientClick(patient)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-700 font-semibold text-sm">
                          {patient.contact_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{patient.contact_name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {patient.upcoming_appointment_count} upcoming
                          </Badge>
                        </div>
                        
                        {!compact && (
                          <div className="text-sm text-gray-500 mt-1">
                            {formatPhoneNumber(patient.contact_phone)}
                          </div>
                        )}
                        
                        {nextAppointment && (
                          <div className="flex items-center gap-1 text-sm text-blue-600 mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(nextAppointment.date)}</span>
                            {nextAppointment.type && nextAppointment.type !== 'Unknown' && (
                              <span className="text-gray-500">• {nextAppointment.type}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCallPatient(patient.contact_phone)
                          }}
                          className="cursor-pointer"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation()
                            // Assuming we might have email in the future
                            handleEmailPatient(`${patient.contact_name.toLowerCase().replace(' ', '.')}@example.com`)
                          }}
                          className="cursor-pointer"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </BlurFade>
  )
} 