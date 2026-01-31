import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBooking } from '../contexts/BookingContext';

const services = {
  general: { name: 'General Consultation', duration: '30 min', price: 150 },
  specialty: { name: 'Specialty Screening', duration: '60 min', price: 280 },
  followup: { name: 'Follow-up Visit', duration: '15 min', price: 85 },
};

export function BookingConfirmation() {
  const navigate = useNavigate();
  const { bookingData, resetBookingData } = useBooking();

  // Redirect if no booking data
  useEffect(() => {
    if (!bookingData.selectedDate || !bookingData.selectedTime || !bookingData.fullName) {
      navigate('/');
    }
  }, [bookingData, navigate]);

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatDateShort = (date: Date | null) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const serviceName = services[bookingData.selectedService]?.name || 'General Consultation';
  const serviceDuration = services[bookingData.selectedService]?.duration || '30 min';
  return (
    <div className="bg-background-light min-h-screen">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border bg-white px-10 py-3">
        <Link to="/" className="flex items-center gap-4 text-text-primary">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_6_330)">
                <path
                  clipRule="evenodd"
                  d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z"
                  fill="currentColor"
                  fillRule="evenodd"
                />
              </g>
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-tight">MedBook Pro</h2>
        </Link>
        <div className="flex flex-1 justify-end gap-8">
          <div className="flex items-center gap-9">
            <Link to="/admin" className="text-sm font-medium leading-normal hover:text-primary transition-colors">Dashboard</Link>
            <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors">Appointments</a>
            <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors">Messages</a>
          </div>
          <div
            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-gray-200 bg-primary/20"
          />
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto py-8 px-4 sm:px-10">
        {/* Page Headline */}
        <div className="mb-10 text-center">
          <h1 className="text-text-primary text-3xl font-bold leading-tight pb-2">Booking Confirmation Journey</h1>
          <p className="text-text-secondary">Review how your patients see their appointment confirmation on-site and in their inbox.</p>
        </div>

        {/* Split View Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Website Confirmation View */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-primary">language</span>
              <h2 className="text-lg font-bold">Website View</h2>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-border p-8 flex flex-col gap-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="size-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-600 text-4xl">check_circle</span>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-text-primary">Your Appointment is Confirmed</h3>
                  <p className="text-text-secondary mt-1">A confirmation email has been sent to your inbox.</p>
                </div>
              </div>

              {/* Appointment Card Component */}
              <div className="flex flex-col items-stretch justify-start rounded-xl border border-gray-100 bg-background-light overflow-hidden">
                <div
                  className="w-full bg-center bg-no-repeat aspect-[21/9] bg-cover"
                  style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=250&fit=crop")' }}
                />
                <div className="flex w-full flex-col gap-3 p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-lg font-bold leading-tight tracking-tight">Dr. Jane Smith</p>
                      <p className="text-primary font-medium text-sm">Senior Medical Consultant</p>
                    </div>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Confirmed
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span className="material-symbols-outlined text-sm">medical_services</span>
                      <p className="text-sm">{serviceName} ({serviceDuration})</p>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      <p className="text-sm">{formatDate(bookingData.selectedDate)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <p className="text-sm">{bookingData.selectedTime}</p>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      <p className="text-sm">123 Medical Plaza, Suite 400, Chicago, IL</p>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span className="material-symbols-outlined text-sm">{bookingData.visitMethod === 'virtual' ? 'videocam' : 'person'}</span>
                      <p className="text-sm">{bookingData.visitMethod === 'virtual' ? 'Virtual Visit' : 'In-Person Visit'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button className="flex-1 flex cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                      <span className="material-symbols-outlined mr-2 text-base">event</span>
                      Add to Calendar
                    </button>
                    <button className="flex-1 flex cursor-pointer items-center justify-center rounded-lg h-10 px-4 border border-border bg-white text-text-primary text-sm font-semibold hover:bg-gray-50 transition-colors">
                      Manage Visit
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
                <span className="material-symbols-outlined text-primary">info</span>
                <div className="text-sm text-blue-800">
                  <p className="font-bold">Next Steps</p>
                  <p>Please arrive 15 minutes early with your ID and insurance card. If this is your first visit, you may complete your intake forms online.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Email Simulation View */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-primary">mail</span>
              <h2 className="text-lg font-bold">Email Notification</h2>
            </div>
            <div className="bg-white rounded-xl shadow-lg border border-border overflow-hidden flex flex-col">
              {/* Browser-like header */}
              <div className="bg-gray-100 px-4 py-3 border-b border-border flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase">From:</span>
                  <span className="text-sm font-medium">MedBook Pro &lt;no-reply@medbookpro.com&gt;</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase">Subject:</span>
                  <span className="text-sm font-bold">Confirmed: Your appointment with Dr. Julian Smith</span>
                </div>
              </div>

              {/* Email Body Container */}
              <div className="bg-gray-50 p-8 flex justify-center">
                {/* The Actual Email Template */}
                <div className="max-w-[500px] w-full bg-white shadow-sm rounded-sm overflow-hidden border border-gray-100">
                  <div className="bg-primary p-6 text-center">
                    <h2 className="text-white text-xl font-bold">Appointment Confirmation</h2>
                  </div>
                  <div className="p-8">
                    <p className="text-lg mb-4">Hello {bookingData.fullName.split(' ')[0] || 'Patient'},</p>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      Your appointment has been successfully scheduled. We look forward to seeing you soon.
                    </p>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">When</p>
                          <p className="text-sm font-bold">{formatDateShort(bookingData.selectedDate)}</p>
                          <p className="text-xs">{bookingData.selectedTime}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Where</p>
                          <p className="text-sm font-bold">Medical Plaza</p>
                          <p className="text-xs">Suite 400</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-1">Service</p>
                        <p className="text-sm font-bold">{serviceName}</p>
                        <p className="text-xs">{bookingData.visitMethod === 'virtual' ? 'Virtual Visit' : 'In-Person Visit'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <a href="#" className="block w-full bg-primary text-white text-center py-3 rounded-lg font-bold text-sm">
                        Add to Calendar (.ics)
                      </a>
                      <div className="flex gap-2">
                        <a href="#" className="flex-1 bg-white text-gray-700 text-center py-2 border border-gray-200 rounded-lg text-xs font-bold">
                          Reschedule
                        </a>
                        <a href="#" className="flex-1 bg-white text-red-600 text-center py-2 border border-red-100 rounded-lg text-xs font-bold">
                          Cancel
                        </a>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                      <p className="text-xs text-gray-400">
                        MedBook Pro Medical Group<br />
                        Questions? Call us at (555) 012-3456
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Table Component */}
        <div className="mt-16">
          <h2 className="text-text-primary text-xl font-bold leading-tight pb-6 pt-5">Communication Summary</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-text-primary text-sm font-bold border-b border-border">Channel</th>
                  <th className="px-6 py-4 text-text-primary text-sm font-bold border-b border-border">Primary Goal</th>
                  <th className="px-6 py-4 text-text-primary text-sm font-bold border-b border-border">Key Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-6 py-5 text-sm font-bold text-primary">Website Confirmation</td>
                  <td className="px-6 py-5 text-sm text-text-secondary leading-normal">
                    Immediate post-booking feedback and arrival instructions.
                  </td>
                  <td className="px-6 py-5 text-sm text-text-secondary leading-normal">
                    Add to calendar, Manage booking, Directions.
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-5 text-sm font-bold text-primary">Email Notification</td>
                  <td className="px-6 py-5 text-sm text-text-secondary leading-normal">
                    Asynchronous record of appointment with direct calendar integration.
                  </td>
                  <td className="px-6 py-5 text-sm text-text-secondary leading-normal">
                    ICS download, Cancel/Reschedule links, Receipt storage.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="mt-20 border-t border-border py-10 bg-white">
        <div className="max-w-[1280px] mx-auto px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-5 text-primary">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="font-bold text-gray-900">MedBook Pro</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
          <p className="text-xs text-gray-400">© 2023 MedBook Pro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
