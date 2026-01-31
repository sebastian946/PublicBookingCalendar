import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBooking } from '../contexts/BookingContext';

type FormStep = 1 | 2 | 3;

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  reasonForVisit: string;
  symptoms: string;
  insuranceProvider: string;
  insuranceId: string;
}

export function BookingForm() {
  const navigate = useNavigate();
  const { bookingData, updateBookingData } = useBooking();
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [formData, setFormData] = useState<FormData>({
    fullName: bookingData.fullName || '',
    email: bookingData.email || '',
    phone: bookingData.phone || '',
    dateOfBirth: bookingData.dateOfBirth || '',
    reasonForVisit: bookingData.reasonForVisit || '',
    symptoms: bookingData.symptoms || '',
    insuranceProvider: bookingData.insuranceProvider || '',
    insuranceId: bookingData.insuranceId || '',
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Redirect if no appointment was selected
  useEffect(() => {
    if (!bookingData.selectedDate || !bookingData.selectedTime) {
      navigate('/');
    }
  }, [bookingData.selectedDate, bookingData.selectedTime, navigate]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep1 = () => {
    const newErrors: Partial<FormData> = {};
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!validateEmail(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as FormStep);
    } else {
      // Save all form data to context before navigating to confirmation
      updateBookingData({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        reasonForVisit: formData.reasonForVisit,
        symptoms: formData.symptoms,
        insuranceProvider: formData.insuranceProvider,
        insuranceId: formData.insuranceId,
      });
      navigate('/confirmation');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FormStep);
    } else {
      navigate('/');
    }
  };

  const stepTitles = {
    1: 'Patient Details',
    2: 'Reason for Visit',
    3: 'Payment & Insurance',
  };

  const nextStepTitles = {
    1: 'Reason for Visit',
    2: 'Payment & Insurance',
    3: 'Confirmation',
  };

  return (
    <div className="bg-background-light min-h-screen">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-light px-6 md:px-20 lg:px-40 py-4 bg-white sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-4 text-text-primary">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M44 4H30.6666V17.3334H17.3334V30.6666H4V44H44V4Z" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-tight">ConsultancyPro</h2>
        </Link>
        <div className="flex gap-2">
          <button className="flex items-center justify-center rounded-lg h-10 bg-gray-100 text-text-primary px-3 hover:bg-gray-200 transition-colors">
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          <button className="flex items-center justify-center rounded-lg h-10 bg-gray-100 text-text-primary px-3 hover:bg-gray-200 transition-colors">
            <span className="material-symbols-outlined text-xl">account_circle</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 justify-center py-10 px-4 md:px-20 lg:px-40">
        <div className="flex flex-col max-w-[800px] flex-1">
          {/* Page Heading */}
          <div className="flex flex-wrap justify-between gap-3 p-4">
            <div className="flex min-w-72 flex-col gap-1">
              <p className="text-text-primary text-3xl font-bold leading-tight">Book Your Appointment</p>
              <p className="text-text-secondary text-base font-normal leading-normal">
                Please fill in your details to secure your slot with our professionals.
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-border-light shadow-sm mb-6">
            <div className="flex gap-6 justify-between items-center">
              <p className="text-text-primary text-base font-semibold leading-normal flex items-center gap-2">
                <span className="flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs">
                  {currentStep}
                </span>
                Step {currentStep} of 3: {stepTitles[currentStep]}
              </p>
              <p className="text-primary text-sm font-bold leading-normal">
                {Math.round((currentStep / 3) * 100)}% Complete
              </p>
            </div>
            <div className="rounded-full bg-gray-200 h-2 w-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-text-secondary text-sm font-normal">
              <span className="material-symbols-outlined text-base">arrow_forward</span>
              Next: {nextStepTitles[currentStep]}
            </div>
          </div>

          {/* Main Form Card */}
          <div className="bg-white border border-border-light rounded-xl shadow-md overflow-hidden">
            <div className="p-6 md:p-8">
              {currentStep === 1 && (
                <>
                  <h3 className="text-text-primary text-2xl font-bold leading-tight pb-6 border-b border-border-light mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">person</span>
                    Patient Information
                  </h3>
                  <form className="space-y-6">
                    {/* Full Name */}
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col w-full">
                        <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                          Full Name <span className="text-red-500">*</span>
                        </p>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => handleInputChange('fullName', e.target.value)}
                          className={`flex w-full rounded-lg text-text-primary border ${
                            errors.fullName ? 'border-red-500 bg-red-50' : 'border-border'
                          } bg-white h-14 placeholder:text-gray-400 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none`}
                          placeholder="e.g. John Doe"
                        />
                        {errors.fullName && (
                          <p className="text-red-500 text-xs font-medium flex items-center gap-1 mt-1">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {errors.fullName}
                          </p>
                        )}
                      </label>
                    </div>

                    {/* Email and Phone Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col w-full">
                          <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                            Email Address <span className="text-red-500">*</span>
                          </p>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className={`flex w-full rounded-lg text-text-primary border ${
                              errors.email ? 'border-red-500 bg-red-50' : 'border-border'
                            } bg-white h-14 placeholder:text-gray-400 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none`}
                            placeholder="name@example.com"
                          />
                          {errors.email && (
                            <p className="text-red-500 text-xs font-medium flex items-center gap-1 mt-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {errors.email}
                            </p>
                          )}
                        </label>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col w-full">
                          <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                            Phone Number <span className="text-red-500">*</span>
                          </p>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className={`flex w-full rounded-lg text-text-primary border ${
                              errors.phone ? 'border-red-500 bg-red-50' : 'border-border'
                            } bg-white h-14 placeholder:text-gray-400 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none`}
                            placeholder="+1 (555) 000-0000"
                          />
                          {errors.phone && (
                            <p className="text-red-500 text-xs font-medium flex items-center gap-1 mt-1">
                              <span className="material-symbols-outlined text-sm">error</span>
                              {errors.phone}
                            </p>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col w-48">
                        <p className="text-text-primary text-sm font-semibold leading-normal pb-2">Date of Birth</p>
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                          className="flex w-full rounded-lg text-text-primary border border-border bg-white h-14 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        />
                      </label>
                    </div>
                  </form>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <h3 className="text-text-primary text-2xl font-bold leading-tight pb-6 border-b border-border-light mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">medical_services</span>
                    Reason for Visit
                  </h3>
                  <form className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col w-full">
                        <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                          Primary Reason <span className="text-red-500">*</span>
                        </p>
                        <select
                          value={formData.reasonForVisit}
                          onChange={(e) => handleInputChange('reasonForVisit', e.target.value)}
                          className="flex w-full rounded-lg text-text-primary border border-border bg-white h-14 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="">Select a reason</option>
                          <option value="checkup">General Checkup</option>
                          <option value="followup">Follow-up Visit</option>
                          <option value="consultation">New Consultation</option>
                          <option value="emergency">Urgent Care</option>
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col w-full">
                        <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                          Describe Your Symptoms
                        </p>
                        <textarea
                          value={formData.symptoms}
                          onChange={(e) => handleInputChange('symptoms', e.target.value)}
                          className="flex w-full rounded-lg text-text-primary border border-border bg-white min-h-[120px] placeholder:text-gray-400 px-4 py-3 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                          placeholder="Please describe any symptoms or concerns you'd like to discuss..."
                        />
                      </label>
                    </div>
                  </form>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <h3 className="text-text-primary text-2xl font-bold leading-tight pb-6 border-b border-border-light mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">payments</span>
                    Payment & Insurance
                  </h3>
                  <form className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col w-full">
                        <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                          Insurance Provider
                        </p>
                        <select
                          value={formData.insuranceProvider}
                          onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                          className="flex w-full rounded-lg text-text-primary border border-border bg-white h-14 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="">Select provider</option>
                          <option value="aetna">Aetna</option>
                          <option value="bluecross">Blue Cross Blue Shield</option>
                          <option value="cigna">Cigna</option>
                          <option value="united">UnitedHealthcare</option>
                          <option value="none">Self-Pay (No Insurance)</option>
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col w-full">
                        <p className="text-text-primary text-sm font-semibold leading-normal pb-2">
                          Insurance ID / Member Number
                        </p>
                        <input
                          type="text"
                          value={formData.insuranceId}
                          onChange={(e) => handleInputChange('insuranceId', e.target.value)}
                          className="flex w-full rounded-lg text-text-primary border border-border bg-white h-14 placeholder:text-gray-400 px-4 text-base font-normal focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                          placeholder="Enter your member ID"
                        />
                      </label>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
                      <span className="material-symbols-outlined text-primary">info</span>
                      <div className="text-sm text-blue-800">
                        <p className="font-bold">Payment Information</p>
                        <p>Payment will be collected at the time of your visit. Please bring your insurance card and a valid ID.</p>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Form Footer Controls */}
            <div className="bg-gray-50 p-6 flex justify-between items-center border-t border-border-light">
              <button
                onClick={handleBack}
                className="flex items-center justify-center rounded-lg h-12 px-6 bg-transparent text-text-secondary font-bold hover:bg-gray-100 transition-colors gap-2"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                {currentStep === 1 ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={handleNext}
                className="flex items-center justify-center rounded-lg h-12 px-10 bg-primary text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-primary/20 gap-2"
              >
                {currentStep === 3 ? 'Complete Booking' : `Continue to Step ${currentStep + 1}`}
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Step Summary */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60">
            <div className={`p-4 border border-dashed rounded-lg flex items-center gap-3 ${currentStep >= 2 ? 'border-primary bg-primary/5' : 'border-gray-300'}`}>
              <span className={`material-symbols-outlined ${currentStep >= 2 ? 'text-primary' : 'text-gray-400'}`}>medical_services</span>
              <span className="text-sm font-medium">Reason for Visit</span>
            </div>
            <div className={`p-4 border border-dashed rounded-lg flex items-center gap-3 ${currentStep >= 3 ? 'border-primary bg-primary/5' : 'border-gray-300'}`}>
              <span className={`material-symbols-outlined ${currentStep >= 3 ? 'text-primary' : 'text-gray-400'}`}>payments</span>
              <span className="text-sm font-medium">Payment & Insurance</span>
            </div>
            <div className="p-4 border border-dashed border-gray-300 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined text-gray-400">event_available</span>
              <span className="text-sm font-medium">Confirmation</span>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-12 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <span className="material-symbols-outlined text-lg">lock</span>
            <span>Your data is encrypted and secure. HIPAA Compliant.</span>
          </div>
        </div>
      </main>

      {/* Sticky Help Button */}
      <div className="fixed bottom-6 right-6">
        <button className="size-14 rounded-full bg-white shadow-xl border border-gray-100 flex items-center justify-center text-primary hover:scale-105 transition-transform">
          <span className="material-symbols-outlined">help</span>
        </button>
      </div>
    </div>
  );
}
