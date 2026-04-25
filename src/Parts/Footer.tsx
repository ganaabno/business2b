export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mono-container px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center gap-6 text-center">
          <div>
            <h2 className="mono-title text-3xl">GTrip.mn</h2>
            <p className="mono-subtitle text-sm mt-2">
              Modern travel operations, simplified.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <a href="#" className="hover:text-gray-900 transition-colors">
              About
            </a>
            <a href="#" className="hover:text-gray-900 transition-colors">
              Services
            </a>
            <a href="#" className="hover:text-gray-900 transition-colors">
              Contact
            </a>
            <a href="#" className="hover:text-gray-900 transition-colors">
              Careers
            </a>
          </div>

          <div className="flex justify-center gap-3">
            {["M", "X", "in", "IG"].map((icon) => (
              <button
                key={icon}
                className="mono-button mono-button--ghost w-10 h-10 rounded-full p-0 text-xs"
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-500 border border-gray-200 rounded-full px-4 py-2">
            © 2025 All Rights Reserved • GTrip.mn
          </div>
        </div>
      </div>
    </footer>
  );
}
