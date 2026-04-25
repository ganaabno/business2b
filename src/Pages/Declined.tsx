// src/Pages/Declined.tsx
export default function Declined() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Request Declined</h1>
      <p className="text-gray-700 text-center mb-4">
        Sorry, your request was declined. If you believe this is a mistake, please contact us.
      </p>
      <a href="mailto:admin@yourdomain.com" className="text-blue-600 hover:text-blue-800">Contact Support</a>
    </div>
  );
}
