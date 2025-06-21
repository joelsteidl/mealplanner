"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function MainNav() {
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.svg"
                alt="Meal Planner"
                width={48}
                height={48}
                className="h-12 w-auto"
              />
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className={`text-sm ${
                  isActive("/")
                    ? "text-blue-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Calendar
              </Link>
              <Link
                href="/recipes"
                className={`text-sm ${
                  isActive("/recipes")
                    ? "text-blue-600 font-medium"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Recipes
              </Link>
            </div>
          </div>
          
          {/* User Menu Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Settings className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      isActive("/settings") ? "text-blue-600 bg-blue-50" : "text-gray-700"
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
