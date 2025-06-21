import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { CalendarSettings } from "@/components/calendar/calendar-settings";

export default async function SettingsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h1 className="text-2xl font-semibold mb-6 text-gray-900">Settings</h1>
          
          <div className="space-y-8">
            <CalendarSettings />
          </div>
        </div>
      </div>
    </main>
  );
}
