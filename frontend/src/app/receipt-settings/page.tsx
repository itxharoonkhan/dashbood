import ProtectedRoute from "@/components/protected-route"
import ReceiptSettingsClient from "./ReceiptSettingsClient"

export default function ReceiptSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <ReceiptSettingsClient />
    </ProtectedRoute>
  )
}
