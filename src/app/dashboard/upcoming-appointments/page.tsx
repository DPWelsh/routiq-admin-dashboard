'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Calendar, ArrowLeft, Users } from 'lucide-react'
import { UpcomingAppointments } from '@/components/features/patients/upcoming-appointments'
import { BlurFade } from '@/components/magicui'

interface PatientWithUpcoming {
  id: number
  contact_id: string
  contact_name: string
  contact_phone: string
  upcoming_appointment_count: number
  upcoming_appointments: string | Array<{ id: string; date: string; type: string }>
  recent_appointment_count: number
  total_appointment_count: number
  last_appointment_date: string | null
  created_at: string
  updated_at: string
}

export default function UpcomingAppointmentsPage() {
  const router = useRouter()

  const handlePatientClick = (patient: PatientWithUpcoming) => {
    // Navigate to the patient's conversation using phone number
    if (patient.contact_phone) {
      console.log('Navigating to conversation for phone:', patient.contact_phone)
      
      // Format phone number for navigation
      let formattedPhone = patient.contact_phone
      if (!patient.contact_phone.startsWith('+')) {
        const cleanedPhone = patient.contact_phone.replace(/\D/g, '')
        if (cleanedPhone.length === 10) {
          formattedPhone = `+1${cleanedPhone}`
        } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith('1')) {
          formattedPhone = `+${cleanedPhone}`
        } else {
          formattedPhone = cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`
        }
      }
      
      const encodedPhone = encodeURIComponent(formattedPhone)
      router.push(`/dashboard/conversations/phone?phone=${encodedPhone}`)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-gray-300" />
            <Calendar className="h-5 w-5 text-purple-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h1>
              <p className="text-sm text-gray-600">Patients with scheduled future appointments</p>
            </div>
          </div>
          <Button 
            onClick={() => router.push('/dashboard/patients')}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            All Patients
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <BlurFade delay={0.1}>
          <div className="max-w-4xl mx-auto">
            <UpcomingAppointments 
              limit={100}
              showRefresh={true}
              compact={false}
              onPatientClick={handlePatientClick}
              title="All Patients with Upcoming Appointments"
            />
          </div>
        </BlurFade>
      </div>
    </div>
  )
} 