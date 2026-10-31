"use client";

import { useState } from "react";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/navigation/resizable-navbar";
import Link from "next/link";
import { trackNavClick, trackCTAInteraction, trackBusinessIntent } from "@/lib/analytics";
import { UTMTrackedLink } from "@/components/ui/marketing/utm-link";
import { navCta } from "@/config/landing";
import { DynamicNavCTA } from "@/components/landing/DynamicNavCTA";
import { IconChevronDown } from "@tabler/icons-react";

const navItems = [
  {
    name: "Product",
    dropdown: [
      { name: "Product", link: "/product" },
      { name: "How it works", link: "/how-it-works" },
      { name: "Sako Notifies", link: "/slack" },
      { name: "Composer", link: "/composer", badge: "Soon" },
    ],
  },
  {
    name: "Solutions",
    dropdown: [
      
      {
        label: "For",
        items: [
          { name: "Founders", link: "/for/founders" },
          { name: "Marketing Teams", link: "/for/marketing-teams" },
          { name: "Growth Teams", link: "/for/growth-teams" },
        ],
      },
      {
        label: "Use cases",
        items: [
          { name: "Startups", link: "/use-cases/startups" },
          { name: "Scale-ups", link: "/use-cases/scale-ups" },
          { name: "SaaS", link: "/use-cases/saas" },
        ],
      },
      {
        label: "Services",
        items: [
          { name: "What We Do", link: "/services" },
        ],
      },
    ],
  },
  {
    name: "Pricing",
    dropdown: [
      { name: "Pricing", link: "/pricing" },
      { name: "ROI Calculator", link: "/roi-calculator" },
      { name: "Enterprise", link: "/enterprise" },
    ],
  },
];

// Flat list for mobile navigation
const mobileNavItems = [
  { name: "Product", link: "/product", section: "Product" },
  { name: "How it works", link: "/how-it-works", section: "Product" },
  { name: "Sako Notifies", link: "/slack", section: "Product" },
  { name: "Composer", link: "/composer", section: "Product", badge: "Soon" },
  { name: "What We Do", link: "/services", section: "Services" },
  { name: "Founders", link: "/for/founders", section: "For" },
  { name: "Marketing Teams", link: "/for/marketing-teams", section: "For" },
  { name: "Growth Teams", link: "/for/growth-teams", section: "For" },
  { name: "Startups", link: "/use-cases/startups", section: "Use cases" },
  { name: "Scale-ups", link: "/use-cases/scale-ups", section: "Use cases" },
  { name: "SaaS", link: "/use-cases/saas", section: "Use cases" },
  { name: "Pricing", link: "/pricing", section: "Pricing" },
  { name: "ROI Calculator", link: "/roi-calculator", section: "Pricing" },
  { name: "Enterprise", link: "/enterprise", section: "Pricing", subtext: "from $8.5k" },
];

export function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Group mobile items by section
  const sections = ["Product", "Services", "For", "Use cases", "Pricing"];

  return (
    <Navbar>
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo />
        <NavItems
          items={navItems}
          onItemClick={(item) => trackNavClick(item.name)}
        />
        <div className="flex items-center gap-3 shrink-0">
          <UTMTrackedLink
            href={navCta.secondaryHref}
            campaign="nav"
            onClick={() => {
              trackCTAInteraction('book_call', 'navbar', 'click');
              trackBusinessIntent('book_call');
            }}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-black transition-colors whitespace-nowrap"
          >
            {navCta.secondaryLabel}
          </UTMTrackedLink>
          <DynamicNavCTA />
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle
            isOpen={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          <div className="flex flex-col gap-2 w-full max-h-[60vh] overflow-y-auto">
            {sections.map((section) => {
              const sectionItems = mobileNavItems.filter(item => item.section === section);
              const isExpanded = expandedSection === section;
              
              return (
                <div key={section} className="border-b border-gray-100 pb-2 last:border-0">
                  <button
                    onClick={() => toggleSection(section)}
                    className="flex items-center justify-between w-full py-2 text-gray-800 hover:text-black transition-colors text-sm font-semibold uppercase tracking-wider"
                  >
                    {section}
                    <IconChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  {isExpanded && (
                    <div className="pl-4 pb-2 flex flex-col gap-1">
                      {sectionItems.map((item, idx) => (
                        <Link
                          key={`mobile-${section}-${idx}`}
                          href={item.link}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            trackNavClick(item.name);
                          }}
                          className="flex items-center gap-2 py-2 text-gray-600 hover:text-black transition-colors text-sm"
                        >
                          {item.name}
                          {item.badge && (
                            <span className="text-[10px] font-bold uppercase bg-[#9AE83E]/20 text-[#6B9E2E] px-1.5 py-0.5 rounded">
                              {item.badge}
                            </span>
                          )}
                          {item.subtext && (
                            <span className="text-xs text-gray-400">{item.subtext}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex w-full flex-col gap-3 pt-4 border-t border-gray-100 mt-2">
            <UTMTrackedLink
              href={navCta.secondaryHref}
              campaign="nav"
              className="w-full py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-black border border-gray-200 rounded-full transition-colors"
            >
              {navCta.secondaryLabel}
            </UTMTrackedLink>
            <DynamicNavCTA className="w-full py-3" />
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
