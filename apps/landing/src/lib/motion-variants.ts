import { Variants } from "framer-motion"

// --- Global Motion Configuration ---

/**
 * Standard bezier curve for sophisticated, smooth, and stable motion
 * Used primarily for entrances, slides, and scaling interactions.
 */
export const springTransition = {
    type: "spring" as const,
    stiffness: 100,
    damping: 20,
    mass: 1,
}

export const smoothTransition = {
    duration: 0.6,
    ease: [0.16, 1, 0.3, 1] as const, // ease-out-expo equivalent
}

export const fastTransition = {
    duration: 0.3,
    ease: [0.16, 1, 0.3, 1] as const,
}

// 2026 Premium Primitives
export const microTransition = {
    duration: 0.2, // 200ms
    ease: "easeOut" as const,
}

export const stepTransition = {
    duration: 0.35, // 350ms
    ease: "easeInOut" as const,
}

export const slowBreatheTransition = {
    duration: 4, // 4s loop
    ease: "easeInOut" as const,
    repeat: Infinity,
    repeatType: "reverse" as const,
}

export const cssTiming = "cubic-bezier(0.16, 1, 0.3, 1)"

// --- Unified Entrance Variants ---

/**
 * Stagger children container
 * Applies to Bento scenes and complex hero items to ensure smooth waterfalls.
 */
export const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.1,
        },
    },
}

/**
 * Base unified fade + slide-up variant (Replacing overlap in row-slide, slideUpFade, card-entry)
 */
export const fadeSlideUp: Variants = {
    hidden: {
        opacity: 0,
        y: 20,
    },
    show: {
        opacity: 1,
        y: 0,
        transition: smoothTransition,
    },
}

export const fadeSlideLeft: Variants = {
    hidden: {
        opacity: 0,
        x: 20,
    },
    show: {
        opacity: 1,
        x: 0,
        transition: smoothTransition,
    },
}

export const fadeSlideRight: Variants = {
    hidden: {
        opacity: 0,
        x: -20,
    },
    show: {
        opacity: 1,
        x: 0,
        transition: smoothTransition,
    },
}

/**
 * Blur reveal for typography/eyebrows
 */
export const blurReveal: Variants = {
    hidden: {
        filter: "blur(10px)",
        opacity: 0,
        y: 10,
    },
    show: {
        filter: "blur(0px)",
        opacity: 1,
        y: 0,
        transition: smoothTransition,
    },
}

/**
 * General unified scale pop (nudge/ping)
 */
export const scalePop: Variants = {
    hidden: {
        opacity: 0,
        scale: 0.95,
    },
    show: {
        opacity: 1,
        scale: 1,
        transition: springTransition,
    },
}

// --- 2026 Premium Semantic Variants ---

export const hoverFocus: Variants = {
    rest: {
        y: 0,
        scale: 1,
        boxShadow: "0px 0px 0px rgba(0,0,0,0)",
        transition: microTransition
    },
    hover: {
        y: -2,
        scale: 1.02,
        boxShadow: "0px 4px 12px rgba(0,0,0,0.05)",
        transition: microTransition
    }
}

export const successBreathe: Variants = {
    rest: { scale: 1, backgroundColor: "var(--background)" },
    success: {
        scale: [1, 1.03, 1],
        backgroundColor: ["var(--background)", "rgba(154, 232, 62, 0.1)", "var(--background)"],
        transition: {
            duration: 0.8,
            ease: "easeInOut",
            times: [0, 0.2, 1] // Fast pop, slow settle
        }
    }
}

export const ghostedDrift: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
        opacity: 0.2,
        y: -10,
        transition: {
            duration: 6,
            ease: "linear",
            repeat: Infinity,
        }
    }
}
