import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/layout/accordion";

interface FAQItem {
  question: string;
  answer: string | React.ReactNode;
}

interface FAQAccordionProps {
  title?: {
    prefix?: string;
    italic?: string;
    suffix?: string;
  };
  subtitle?: string;
  items: FAQItem[];
  compact?: boolean;
}

export function FAQAccordion({ title, subtitle, items = [], compact = false }: FAQAccordionProps) {
  // Replace capital Q with lowercase q in questions
  const formatQuestion = (question: string) => {
    return question.replace(/Q:/g, 'q:').replace(/^Q\s/g, 'q ');
  };

  return (
    <section className={compact ? "py-12 px-6" : "py-24 px-6"}>
      <div className="max-w-[800px] mx-auto">
        {title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-medium text-black tracking-tight mb-4">
              {title.prefix?.replace(/Q/g, 'q')}
              {title.italic && <span className="font-serif italic font-normal"> {title.italic?.replace(/Q/g, 'q')}</span>}
              {title.suffix?.replace(/Q/g, 'q')}
            </h2>
            {subtitle && <p className="text-gray-600 max-w-2xl mx-auto">{subtitle}</p>}
          </div>
        )}
        
        <Accordion type="single" collapsible defaultValue="item-0" className="space-y-3 mb-4">
          {items.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md data-[state=open]:shadow-lg transition-all duration-300"
            >
              <AccordionTrigger className="px-6 py-5 text-left font-medium text-black hover:no-underline [&>svg]:text-gray-400 [&>svg]:w-5 [&>svg]:h-5 focus:outline-none focus-visible:outline-none">
                {formatQuestion(item.question)}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 text-sm text-gray-600 leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
