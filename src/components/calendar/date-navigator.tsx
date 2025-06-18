"use client";

import { useState } from "react";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateNavigatorProps {
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ onDateChange }: DateNavigatorProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = direction === "prev" 
      ? subDays(currentDate, 1) 
      : addDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white rounded-lg shadow">
      <button
        onClick={() => navigateDate("prev")}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="text-lg font-medium">
        {format(currentDate, "MMMM d, yyyy")}
      </span>
      <button
        onClick={() => navigateDate("next")}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
