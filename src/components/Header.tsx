import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 bg-white px-10 py-3 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-4 text-text-primary">
        <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
          <span className="material-symbols-outlined">medical_services</span>
        </div>
        <h2 className="text-lg font-bold leading-tight tracking-tight">ProConsult Booking</h2>
      </Link>
      <div className="flex flex-1 justify-end gap-8">
        <div className="flex items-center gap-9">
          <Link to="/" className="text-sm font-medium leading-normal hover:text-primary transition-colors">Find a Doctor</Link>
          <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors">Services</a>
          <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors">Clinics</a>
          <a href="#" className="text-sm font-medium leading-normal hover:text-primary transition-colors">About Us</a>
        </div>
        <Link
          to="/admin"
          className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-wide hover:bg-blue-700 transition-colors"
        >
          <span className="truncate">Sign In</span>
        </Link>
      </div>
    </header>
  );
}
