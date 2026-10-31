"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";
import Link from "next/link";
import Image from "next/image";
import React, { useRef, useState } from "react";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavSubItem {
  name: string;
  link: string;
  subtext?: string;
  badge?: string;
}

interface NavItemGroup {
  label: string;
  items: NavSubItem[];
}

interface NavItem {
  name: string;
  link?: string;
  dropdown?: NavSubItem[] | NavItemGroup[];
}

interface NavItemsProps {
  items: NavItem[];
  className?: string;
  onItemClick?: (item: { name: string; link: string }) => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 50) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  });

  return (
    <motion.div
      className={cn("fixed inset-x-0 top-4 z-50 w-full px-4 md:px-6", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      initial={false}
      animate={{
        backdropFilter: visible ? "blur(16px)" : "blur(12px)",
        boxShadow: visible
          ? "0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)"
          : "0 1px 3px rgba(0, 0, 0, 0.04)",
        width: visible ? "60%" : "100%",
        maxWidth: visible ? "800px" : "1024px",
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 30,
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full flex-row items-center justify-between rounded-full border border-gray-200/60 bg-white/70 px-6 py-2 lg:flex",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

// Helper to check if dropdown items are grouped
const isGroupedDropdown = (dropdown: NavSubItem[] | NavItemGroup[]): dropdown is NavItemGroup[] => {
  const first = dropdown[0];
  return dropdown.length > 0 && first != null && "label" in first;
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      onMouseLeave={() => {
        setHovered(null);
        setOpenDropdown(null);
      }}
      className={cn(
        "flex flex-row items-center justify-center text-sm font-medium",
        className,
      )}
    >
      {items.map((item, idx) => {
        const hasDropdown = !!item.dropdown;
        
        if (hasDropdown) {
          return (
            <div
              key={`dropdown-${idx}`}
              className="relative"
              onMouseEnter={() => {
                setHovered(idx);
                setOpenDropdown(idx);
              }}
            >
              <button
                className="relative px-4 py-2 text-gray-600 hover:text-black transition-colors flex items-center gap-1"
              >
                {hovered === idx && (
                  <motion.div
                    layoutId="hovered"
                    className="absolute inset-0 h-full w-full rounded-full bg-gray-100"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-20 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  {item.name}
                </span>
                <svg
                  className={cn(
                    "relative z-20 w-3 h-3 transition-transform duration-200",
                    openDropdown === idx && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <AnimatePresence>
                {openDropdown === idx && (
                  <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full left-0 mt-2 min-w-[220px] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50"
                  >
                    {isGroupedDropdown(item.dropdown!) ? (
                      // Grouped dropdown (for Solutions)
                      <div className="py-2">
                        {(item.dropdown as NavItemGroup[]).map((group, gIdx) => (
                          <div key={`group-${gIdx}`}>
                            {gIdx > 0 && <div className="border-t border-gray-100 my-2" />}
                            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              {group.label}
                            </div>
                            {(group.items ?? []).map((subItem, sIdx) => (
                              <Link
                                key={`sub-${sIdx}`}
                                href={subItem.link}
                                onClick={() => {
                                  onItemClick?.({ name: subItem.name, link: subItem.link });
                                  setOpenDropdown(null);
                                }}
                                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                              >
                                <span className="font-medium">{subItem.name}</span>
                                {subItem.subtext && (
                                  <span className="ml-2 text-xs text-gray-400">{subItem.subtext}</span>
                                )}
                                {subItem.badge && (
                                  <span className="ml-2 text-[10px] font-bold uppercase bg-[#9AE83E]/20 text-[#6B9E2E] px-1.5 py-0.5 rounded">
                                    {subItem.badge}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Simple dropdown
                      <div className="py-2">
                        {((item.dropdown ?? []) as NavSubItem[]).map((subItem, sIdx) => (
                          <Link
                            key={`sub-${sIdx}`}
                            href={subItem.link}
                            onClick={() => {
                              onItemClick?.({ name: subItem.name, link: subItem.link });
                              setOpenDropdown(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                          >
                            <span className="font-medium">{subItem.name}</span>
                            {subItem.subtext && (
                              <span className="text-xs text-gray-400">{subItem.subtext}</span>
                            )}
                            {subItem.badge && (
                              <span className="text-[10px] font-bold uppercase bg-[#9AE83E]/20 text-[#6B9E2E] px-1.5 py-0.5 rounded">
                                {subItem.badge}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        }
        
        // Regular link item (no dropdown)
        const isExternal = item.link?.startsWith("http");
        const LinkComponent = isExternal ? "a" : Link;
        const linkProps = isExternal 
          ? { href: item.link!, target: "_blank", rel: "noopener noreferrer" }
          : { href: item.link! };
        
        return (
          <LinkComponent
            onMouseEnter={() => {
              setHovered(idx);
              setOpenDropdown(null);
            }}
            onClick={() => onItemClick?.({ name: item.name, link: item.link! })}
            className="relative px-4 py-2 text-gray-600 hover:text-black transition-colors"
            key={`link-${idx}`}
            {...linkProps}
          >
            {hovered === idx && (
              <motion.div
                layoutId="hovered"
                className="absolute inset-0 h-full w-full rounded-full bg-gray-100"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-20 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">{item.name}</span>
          </LinkComponent>
        );
      })}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      initial={false}
      animate={{
        backdropFilter: visible ? "blur(16px)" : "blur(12px)",
        width: visible ? "90%" : "100%",
        maxWidth: visible ? "calc(100vw-2rem)" : "calc(100vw-2rem)",
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 30,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full flex-col items-center justify-between rounded-2xl border border-gray-200/60 bg-white/80 px-4 py-3 lg:hidden",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-x-4 top-4 z-40 bg-black/15 backdrop-blur-lg rounded-2xl"
          />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className={cn(
              "absolute inset-x-0 top-full mt-2 z-50 flex w-full flex-col items-start justify-start gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-xl",
              className,
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      {isOpen ? (
        <IconX className="w-5 h-5" />
      ) : (
        <IconMenu2 className="w-5 h-5" />
      )}
    </button>
  );
};

export const NavbarLogo = () => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center gap-2 shrink-0"
    >
     <Image
  src="/sako-black.svg"
  alt="Sako"
  width={56}
  height={14}
  className="w-14 h-3.5"
  priority
/>

    </Link>
  );
};

export const NavbarButton = () => {
  // Base classes moved to individual components for consistency
  return null;
};
