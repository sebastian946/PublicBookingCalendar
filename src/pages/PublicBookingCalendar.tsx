import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Calendar } from '../components/Calendar';
import { TimeSlots } from '../components/TimeSlots';
import { useBooking } from '../contexts/BookingContext';

type ServiceType = 'general' | 'specialty' | 'followup';
type VisitMethod = 'in-person' | 'virtual';

const services = {
  general: { name: 'General Consultation', duration: '30 min', price: 150 },
  specialty: { name: 'Specialty Screening', duration: '60 min', price: 280 },
  followup: { name: 'Follow-up Visit', duration: '15 min', price: 85 },
};

export function PublicBookingCalendar() {
  const navigate = useNavigate();
  const { updateBookingData } = useBooking();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date(2024, 9, 10));
  const [selectedTime, setSelectedTime] = useState<string | null>('01:00 PM');
  const [selectedService, setSelectedService] = useState<ServiceType>('general');
  const [visitMethod, setVisitMethod] = useState<VisitMethod>('in-person');

  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) {
      alert('Please select a date and time for your appointment');
      return;
    }

    updateBookingData({
      selectedDate,
      selectedTime,
      selectedService,
      visitMethod,
    });

    navigate('/booking');
  };

  return (
    <div className="bg-background-light min-h-screen">
      <Header />
      <main className="max-w-[1440px] mx-auto px-6 py-8">
        {/* Breadcrumbs */}
        <div className="flex flex-wrap gap-2 pb-6">
          <a href="#" className="text-text-secondary text-sm font-medium hover:underline">Home</a>
          <span className="text-text-secondary text-sm font-medium">/</span>
          <a href="#" className="text-text-secondary text-sm font-medium hover:underline">Search Results</a>
          <span className="text-text-secondary text-sm font-medium">/</span>
          <span className="text-text-primary text-sm font-medium">Dr. Jane Smith</span>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Left Sidebar: Professional Info */}
          <aside className="col-span-3 flex flex-col gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex flex-col items-center text-center gap-4 mb-6">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-24 border-4 border-primary/10"
                  style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop")' }}
                />
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold">Dr. Jane Smith</h1>
                  <p className="text-primary text-sm font-semibold">Senior Medical Consultant</p>
                  <p className="text-gray-500 text-xs mt-1">MD, PhD, Cardiology Specialist</p>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/5 text-primary">
                  <span className="material-symbols-outlined">person</span>
                  <p className="text-sm font-semibold">Profile Overview</p>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined">school</span>
                  <p className="text-sm font-medium">Experience & Education</p>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined">star</span>
                  <p className="text-sm font-medium">Reviews (4.9/5)</p>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
                  <span className="material-symbols-outlined">location_on</span>
                  <p className="text-sm font-medium">Location</p>
                </div>
              </div>

              <hr className="my-6 border-gray-100" />

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  With over 15 years of experience in cardiology and general medicine, Dr. Smith specializes in preventative care and chronic disease management.
                </p>
              </div>

              <button className="w-full mt-8 flex cursor-pointer items-center justify-center rounded-lg h-11 px-4 border border-primary text-primary text-sm font-bold hover:bg-primary/5 transition-colors">
                <span className="truncate">Contact Office</span>
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                <img
                  className="w-full h-full object-cover"
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=200&fit=crop"
                  alt="Map"
                />
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">location_on</span>
                123 Medical Plaza, Suite 400, Chicago, IL
              </p>
            </div>
          </aside>

          {/* Center: Calendar Action Area */}
          <section className="col-span-6 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
              <TimeSlots
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onTimeSelect={setSelectedTime}
              />
            </div>

            <div className="mt-auto p-6 bg-gray-50 flex items-center gap-6 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-xs text-gray-500 font-medium">Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-white border border-gray-300 rounded-full" />
                <span className="text-xs text-gray-500 font-medium">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-200 rounded-full" />
                <span className="text-xs text-gray-500 font-medium">Booked/Off</span>
              </div>
            </div>
          </section>

          {/* Right Panel: Filters & Selection */}
          <aside className="col-span-3 flex flex-col gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-base font-bold mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">filter_alt</span>
                Filters
              </h3>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Service Type
                  </label>
                  <div className="flex flex-col gap-3">
                    {(Object.entries(services) as [ServiceType, typeof services.general][]).map(([key, service]) => (
                      <label
                        key={key}
                        className={`relative flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedService === key
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="service"
                          checked={selectedService === key}
                          onChange={() => setSelectedService(key)}
                          className="hidden"
                        />
                        <div className="flex flex-col flex-1">
                          <span className="text-sm font-bold">{service.name}</span>
                          <span className="text-xs text-gray-500">{service.duration} • ${service.price}</span>
                        </div>
                        {selectedService === key && (
                          <span className="material-symbols-outlined text-primary">check_circle</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">
                    Visit Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setVisitMethod('in-person')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                        visitMethod === 'in-person'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <span className="material-symbols-outlined">person</span>
                      <span className="text-[10px] font-bold mt-1">IN-PERSON</span>
                    </button>
                    <button
                      onClick={() => setVisitMethod('virtual')}
                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                        visitMethod === 'virtual'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <span className="material-symbols-outlined">videocam</span>
                      <span className="text-[10px] font-bold mt-1">VIRTUAL</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary text-white rounded-xl p-6 shadow-lg shadow-primary/20">
              <h4 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-4">Summary</h4>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-start">
                  <span className="text-sm opacity-90">{services[selectedService].name}</span>
                  <span className="text-sm font-bold">${services[selectedService].price.toFixed(2)}</span>
                </div>
                {selectedDate && selectedTime && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm opacity-90">{formatDate(selectedDate)} at {selectedTime}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleConfirm}
                className="w-full bg-white text-primary rounded-lg h-12 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                Confirm Appointment
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <p className="text-[10px] text-center mt-4 opacity-70">
                You won't be charged yet. Payment is processed at the clinic.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-500">verified_user</span>
              <p className="text-xs text-gray-500 leading-tight">Secure booking powered by ProConsult Platform</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
