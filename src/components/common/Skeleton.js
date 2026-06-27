import React from 'react';

// Base pulse skeleton block
export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

// Table skeleton — n rows × cols
export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <div className="bg-white rounded-xl border overflow-hidden">
    <div className="bg-gray-50 px-4 py-3 flex gap-4 border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="px-4 py-3.5 border-b last:border-0 flex gap-4 items-center">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-8 h-8 rounded-full flex-shrink-0' : 'flex-1'}`} />
        ))}
      </div>
    ))}
  </div>
);

// Card stat skeleton
export const StatCardSkeleton = () => (
  <div className="bg-white rounded-xl border p-5 flex items-center gap-4">
    <Skeleton className="w-12 h-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-12" />
    </div>
  </div>
);

// Calendar grid skeleton
export const CalendarSkeleton = () => (
  <div className="bg-white rounded-xl border overflow-hidden">
    {/* Header row */}
    <div className="grid grid-cols-8 border-b bg-gray-50">
      <div className="p-3" />
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
        <div key={d} className="p-3 flex justify-center">
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
    {/* Time rows */}
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="grid grid-cols-8 border-b last:border-0">
        <div className="p-3 border-r">
          <Skeleton className="h-2.5 w-12" />
        </div>
        {Array.from({ length: 7 }).map((_, j) => (
          <div key={j} className="p-2 border-r last:border-0 h-12">
            {Math.random() > 0.75 && <Skeleton className="h-full rounded-lg" />}
          </div>
        ))}
      </div>
    ))}
  </div>
);

// Instructor card skeleton
export const InstructorCardSkeleton = () => (
  <div className="bg-white border rounded-xl p-5 flex items-center gap-5 mb-5">
    <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
    <div className="flex gap-6">
      <div className="space-y-1 text-center">
        <Skeleton className="h-6 w-8 mx-auto" />
        <Skeleton className="h-2.5 w-12" />
      </div>
    </div>
  </div>
);

export default Skeleton;
