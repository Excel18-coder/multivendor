
import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Phone, Mail, MapPin } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">US</span>
              </div>
              <span className="text-xl font-bold">Urban Stores</span>
            </div>
            <p className="text-gray-300 mb-4">
              Kenya's premier marketplace connecting local stores with customers across the country.
            </p>
            <div className="flex space-x-4">
              <Facebook size={20} className="text-gray-300 hover:text-white cursor-pointer" />
              <Instagram size={20} className="text-gray-300 hover:text-white cursor-pointer" />
              <Twitter size={20} className="text-gray-300 hover:text-white cursor-pointer" />
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-gray-300 hover:text-white">About Us</Link></li>
              <li><Link to="/marketplace" className="text-gray-300 hover:text-white">Marketplace</Link></li>
              <li><Link to="/stores" className="text-gray-300 hover:text-white">All Stores</Link></li>
              <li><Link to="/seller-dashboard" className="text-gray-300 hover:text-white">Become a Seller</Link></li>
              <li><Link to="/complaints" className="text-gray-300 hover:text-white">Submit Complaint</Link></li>
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Customer Support</h3>
            <ul className="space-y-2">
              <li><Link to="/help" className="text-gray-300 hover:text-white">Help Center</Link></li>
              <li><Link to="/shipping" className="text-gray-300 hover:text-white">Shipping Info</Link></li>
              <li><Link to="/returns" className="text-gray-300 hover:text-white">Returns</Link></li>
              <li><Link to="/terms" className="text-gray-300 hover:text-white">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-gray-300 hover:text-white">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Phone size={16} className="text-gray-300" />
                <span className="text-gray-300">+254793708416</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail size={16} className="text-gray-300" />
                <span className="text-gray-300">urbanstoreke@gmail.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin size={16} className="text-gray-300" />
                <span className="text-gray-300">Nairobi, Kenya</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-300">
            © 2024 Urban Stores Kenya. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
