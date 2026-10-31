"use client";

import { useEffect } from "react";

export function ConsoleEasterEgg() {
  useEffect(() => {
    const ascii = `

 $$$$$$\   $$$$$$\  $$\   $$\  $$$$$$\  
$$  __$$\ $$  __$$\ $$ | $$  |$$  __$$\ 
$$ /  \__|$$ /  $$ |$$ |$$  / $$ /  $$ |
\$$$$$$\  $$$$$$$$ |$$$$$  /  $$ |  $$ |
 \____$$\ $$  __$$ |$$  $$<   $$ |  $$ |
$$\   $$ |$$ |  $$ |$$ |\$$\  $$ |  $$ |
\$$$$$$  |$$ |  $$ |$$ | \$$\  $$$$$$  |
 \______/ \__|  \__|\__|  \__| \______/ 
                                   
 `;

    const styles = [
      "color: #9AE83E",
      "font-family: monospace",
      "font-weight: bold",
      "font-size: 12px",
      "line-height: 0.5",
    ].join(";");

    const textStyles = [
      "color: #fafafa",
      "font-family: sans-serif",
      "font-size: 14px",
      "padding-top: 0px",
    ].join(";");

    const linkStyles = [
      "color: #9AE83E",
      "font-family: sans-serif",
      "font-weight: bold",
      "font-size: 14px",
    ].join(";");

    console.log(`%c${ascii}`, styles);
    console.log(
      "%cHi,\n\nWe’re hiring builder-hackers: design + code, fast opinions, zero fluff.\nSend a 15-min YC-style pitch (along with portfolio/resume) to %chiring@trysako.com%c\nWe reply within 48h.",
      textStyles,
      linkStyles,
      textStyles
    );
  }, []);

  return null;
}

