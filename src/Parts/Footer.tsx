export default function Footer() {
  return (
    <footer className="relative bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-700"></div>
        <div className="absolute -bottom-10 left-1/2 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
      </div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="text-center">
          {/* Logo/Brand */}
          <div className="mb-6">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              GTC-Mongolia
            </h2>
            <div className="mt-2 h-1 w-56 mx-auto bg-gradient-to-r from-cyan-300 via-white to-cyan-300 rounded-full"></div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-8 mb-8 text-white font-medium">
            <a
              href="#"
              className="text-white hover:text-slate-900 transition-colors duration-300 transform hover:scale-110"
            >
              About
            </a>
            <a
              href="#"
              className="text-white hover:text-slate-900 transition-colors duration-300 transform hover:scale-110"
            >
              Services
            </a>
            <a
              href="#"
              className="text-white hover:text-slate-900 transition-colors duration-300 transform hover:scale-110"
            >
              Contact
            </a>
            <a
              href="#"
              className="text-white hover:text-slate-900 transition-colors duration-300 transform hover:scale-110"
            >
              Careers
            </a>
          </div>

          {/* Social Icons */}
          <div className="flex justify-center gap-6 mb-8">
            {["M", "X", "in", "IG"].map((icon, i) => (
              <button
                key={i}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold hover:bg-white hover:text-blue-700 transform hover:scale-125 transition-all duration-300 hover:rotate-12"
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Copyright */}
          <div className="text-white/90 text-sm font-medium backdrop-blur-sm bg-white/10 rounded-full py-3 px-6 inline-block">
            © 2025 All Rights Reserved • GTC-Mongolia
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="h-2 bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400"></div>
    </footer>
  );
}
