import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PublicBookingCalendar } from './pages/PublicBookingCalendar';
import { BookingForm } from './pages/BookingForm';
import { BookingConfirmation } from './pages/BookingConfirmation';
import { AdminDashboard } from './pages/AdminDashboard';
import { BookingProvider } from './contexts/BookingContext';
import { AdminProvider } from './contexts/AdminContext';

function App() {
  return (
    <AdminProvider>
      <BookingProvider>
        <Router>
          <Routes>
            <Route path="/" element={<PublicBookingCalendar />} />
            <Route path="/booking" element={<BookingForm />} />
            <Route path="/confirmation" element={<BookingConfirmation />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Router>
      </BookingProvider>
    </AdminProvider>
  );
}

export default App;
