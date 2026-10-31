import Link from "next/link";
import { Check } from "lucide-react";
import { patterns } from "@/lib/design-tokens";

interface Plan {
  id: string;
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  badge?: string;
}

interface PricingCardsProps {
  title?: { prefix?: string; italic?: string; suffix?: string };
  subtitle?: string;
  plans: Plan[];
  footer?: string;
}

interface CTALinkProps {
  href: string;
  className: string;
  children: React.ReactNode;
}

function CTALink({ href, className, children }: CTALinkProps) {
  if (href.startsWith('http')) {
    return <a href={href} className={className} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <Link href={href} className={className}>{children}</Link>;
}

export function PricingCards({ title, subtitle, plans = [], footer }: PricingCardsProps) {
  return (
    <section id="pricing" className={patterns.section}>
      <div className={patterns.container}>
        {title && (
          <div className="text-center mb-16">
            <h2 className={`${patterns.heading2} mb-4`}>
              {title.prefix}
              {title.italic && <span className={`${patterns.serifItalic}`}> {title.italic}</span>}
              {title.suffix}
            </h2>
            {subtitle && <p className={`${patterns.subtitle} max-w-2xl mx-auto`}>{subtitle}</p>}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-8 transition-all duration-300 hover:-translate-y-1 flex flex-col ${
                plan.highlighted
                  ? 'bg-[#1a1a1a] text-white shadow-2xl shadow-[#9AE83E]/20 ring-2 ring-[#9AE83E]'
                  : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#9AE83E] text-black text-xs font-bold rounded-full uppercase tracking-wide">
                  {plan.badge}
                </span>
              )}
              
              <div className="mb-6">
                <h3 className="font-semibold text-xl mb-2">{plan.name}</h3>
                <p className={`text-sm ${plan.highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
              </div>
              
              <div className="mb-8">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className={`text-sm ${plan.highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
                    /{plan.period}
                  </span>
                )}
              </div>
              
              <div className="flex-grow">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-[#9AE83E]' : 'text-black'}`} />
                      <span className={plan.highlighted ? 'text-gray-300' : 'text-gray-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <CTALink
                href={plan.cta.href}
                className={`block w-full text-center py-3.5 rounded-full font-semibold text-sm transition-all mt-8 ${
                  plan.highlighted
                    ? 'bg-[#9AE83E] text-black hover:bg-white'
                    : 'bg-[#1a1a1a] text-white hover:bg-gray-800'
                }`}
              >
                {plan.cta.label}
              </CTALink>
            </div>
          ))}
        </div>
        
        {footer && (
          <p className="text-center text-sm text-gray-500 mt-8">{footer}</p>
        )}
      </div>
    </section>
  );
}


