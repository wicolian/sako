interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company?: string;
  image?: string;
  variant?: 'default' | 'large' | 'minimal';
}

export function TestimonialCard({
  quote,
  author,
  role,
  company,
  variant = 'default',
}: TestimonialCardProps) {
  if (variant === 'large') {
    return (
      <section className="py-24 px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <svg className="w-12 h-12 text-[#9AE83E] mx-auto mb-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <blockquote className="text-2xl sm:text-3xl font-medium text-black leading-relaxed mb-8">
            "{quote}"
          </blockquote>
          <div>
            <div className="font-semibold text-black">{author}</div>
            <div className="text-sm text-gray-500">
              {role}{company && ` at ${company}`}
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  if (variant === 'minimal') {
    return (
      <div className="border-l-4 border-[#9AE83E] pl-6 py-4">
        <p className="text-gray-600 italic mb-4">"{quote}"</p>
        <div className="text-sm">
          <span className="font-semibold text-black">{author}</span>
          <span className="text-gray-500"> · {role}</span>
        </div>
      </div>
    );
  }
  
  // Default variant
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
      <svg className="w-8 h-8 text-[#9AE83E] mb-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
      <p className="text-gray-600 mb-6">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
          {author.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-sm text-black">{author}</div>
          <div className="text-xs text-gray-500">
            {role}{company && ` at ${company}`}
          </div>
        </div>
      </div>
    </div>
  );
}


