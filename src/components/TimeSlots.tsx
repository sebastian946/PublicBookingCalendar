interface TimeSlotsProps {
  selectedDate: Date | null;
  selectedTime: string | null;
  onTimeSelect: (time: string) => void;
}

const timeSlots = [
  { time: '09:00 AM', available: true },
  { time: '10:30 AM', available: true },
  { time: '01:00 PM', available: true },
  { time: '02:30 PM', available: true },
  { time: '04:00 PM', available: true },
  { time: '05:30 PM', available: false },
];

export function TimeSlots({ selectedDate, selectedTime, onTimeSelect }: TimeSlotsProps) {
  const formatDate = (date: Date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  return (
    <div className="mt-10">
      <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined">schedule</span>
        {selectedDate
          ? `Available Slots for ${formatDate(selectedDate)}`
          : 'Select a date to see available slots'
        }
      </h3>
      <div className="grid grid-cols-4 gap-3">
        {timeSlots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => slot.available && onTimeSelect(slot.time)}
            disabled={!slot.available}
            className={`py-2.5 px-3 border rounded-lg text-sm font-medium transition-all text-center ${
              !slot.available
                ? 'border-gray-200 opacity-40 cursor-not-allowed bg-gray-50'
                : selectedTime === slot.time
                ? 'bg-primary text-white border-primary font-bold'
                : 'border-gray-200 hover:border-primary hover:text-primary'
            }`}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}
