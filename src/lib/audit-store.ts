import { ref } from 'vue'

export const tripAuditOpen = ref(false)

export function openTripAudit(): void {
  tripAuditOpen.value = true
}

export function closeTripAudit(): void {
  tripAuditOpen.value = false
}
