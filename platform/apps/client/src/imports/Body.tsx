function Container() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 tracking-[-0.3px] w-[15.42px]">
        <p className="leading-[16px]">SS</p>
      </div>
    </div>
  );
}

function BackgroundShadow() {
  return (
    <div className="bg-[#9ae83e] box-border content-stretch flex items-center justify-center relative rounded-[12px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] shrink-0 size-[32px]" data-name="Background+Shadow">
      <Container />
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[14px] tracking-[-0.35px] w-[73.95px]">
        <p className="leading-[20px]">sako studio</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[72.16px]">
        <p className="leading-[16.5px]">Admin console</p>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container1 />
      <Container2 />
    </div>
  );
}

function HorizontalBorder() {
  return (
    <div className="relative shrink-0 w-full" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#38444d] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center pb-[17px] pt-[16px] px-[20px] relative w-full">
          <BackgroundShadow />
          <Container3 />
        </div>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col items-start px-[8px] py-0 relative w-full">
          <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.32px] uppercase w-[69.66px]">
            <p className="leading-[16.5px]">Overview</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Svg() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[63.61px]">
        <p className="leading-[19.5px]">Dashboard</p>
      </div>
    </div>
  );
}

function ItemLink() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg />
          <Container5 />
        </div>
      </div>
    </div>
  );
}

function Svg1() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[39.75px]">
        <p className="leading-[19.5px]">Clients</p>
      </div>
    </div>
  );
}

function ItemLink1() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg1 />
          <Container6 />
        </div>
      </div>
    </div>
  );
}

function Svg2() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[46.97px]">
        <p className="leading-[19.5px]">Projects</p>
      </div>
    </div>
  );
}

function ItemLink2() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg2 />
          <Container7 />
        </div>
      </div>
    </div>
  );
}

function Svg3() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container8() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[33.23px]">
        <p className="leading-[19.5px]">Tasks</p>
      </div>
    </div>
  );
}

function ItemLink3() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg3 />
          <Container8 />
        </div>
      </div>
    </div>
  );
}

function List() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="List">
      <ItemLink />
      <ItemLink1 />
      <ItemLink2 />
      <ItemLink3 />
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <Container4 />
      <List />
    </div>
  );
}

function Container10() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col items-start px-[8px] py-0 relative w-full">
          <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.32px] uppercase w-[84.52px]">
            <p className="leading-[16.5px]">Operations</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Svg4() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container11() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[54.22px]">
        <p className="leading-[19.5px]">Schedule</p>
      </div>
    </div>
  );
}

function ItemLink4() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg4 />
          <Container11 />
        </div>
      </div>
    </div>
  );
}

function Svg5() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container12() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[34.69px]">
        <p className="leading-[19.5px]">Billing</p>
      </div>
    </div>
  );
}

function ItemLink5() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg5 />
          <Container12 />
        </div>
      </div>
    </div>
  );
}

function Svg6() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container13() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[45.53px]">
        <p className="leading-[19.5px]">Reports</p>
      </div>
    </div>
  );
}

function ItemLink6() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg6 />
          <Container13 />
        </div>
      </div>
    </div>
  );
}

function List1() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="List">
      <ItemLink4 />
      <ItemLink5 />
      <ItemLink6 />
    </div>
  );
}

function Container14() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="Container">
      <Container10 />
      <List1 />
    </div>
  );
}

function Container15() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col items-start px-[8px] py-0 relative w-full">
          <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.32px] uppercase w-[53.16px]">
            <p className="leading-[16.5px]">System</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Svg7() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container16() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] w-[46.98px]">
        <p className="leading-[19.5px]">Settings</p>
      </div>
    </div>
  );
}

function ItemLink7() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Link">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg7 />
          <Container16 />
        </div>
      </div>
    </div>
  );
}

function Svg8() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container17() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[#d9d9d9] text-[13px] text-center w-[78.06px]">
        <p className="leading-[19.5px]">Toggle theme</p>
      </div>
    </div>
  );
}

function ItemButton() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item → Button">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex gap-[8px] items-center px-[10px] py-[8px] relative w-full">
          <Svg8 />
          <Container17 />
        </div>
      </div>
    </div>
  );
}

function List2() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="List">
      <ItemLink7 />
      <ItemButton />
    </div>
  );
}

function HorizontalBorder1() {
  return (
    <div className="box-border content-stretch flex flex-col gap-[8px] items-start pb-0 pt-[5px] px-0 relative shrink-0 w-full" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#38444d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <Container15 />
      <List2 />
    </div>
  );
}

function Nav() {
  return (
    <div className="h-[1811.25px] relative shrink-0 w-full" data-name="Nav">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="box-border content-stretch flex flex-col gap-[24px] h-[1811.25px] items-start px-[12px] py-[16px] relative w-full">
          <Container9 />
          <Container14 />
          <HorizontalBorder1 />
        </div>
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[29.97px]">
        <p className="leading-[16.5px]">v1.0.0</p>
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.76px] uppercase w-[52.13px]">
        <p className="leading-[16.5px]">studio</p>
      </div>
    </div>
  );
}

function HorizontalBorder2() {
  return (
    <div className="relative shrink-0 w-full" data-name="HorizontalBorder">
      <div aria-hidden="true" className="absolute border-[#38444d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex items-center justify-between pb-[12px] pl-[16px] pr-[15.99px] pt-[13px] relative w-full">
          <Container18 />
          <Container19 />
        </div>
      </div>
    </div>
  );
}

function Aside() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col items-start pl-0 pr-px py-0 relative self-stretch shrink-0 w-[256px]" data-name="Aside">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[0px_1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <HorizontalBorder />
      <Nav />
      <HorizontalBorder2 />
    </div>
  );
}

function Container20() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.76px] uppercase w-[113.89px]">
        <p className="leading-[16.5px]">Active clients</p>
      </div>
    </div>
  );
}

function Container21() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-neutral-50 tracking-[-0.6px] w-[25.5px]">
        <p className="leading-[32px]">32</p>
      </div>
    </div>
  );
}

function Margin() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container21 />
    </div>
  );
}

function Container22() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container20 />
      <Margin />
    </div>
  );
}

function Svg9() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Background() {
  return (
    <div className="bg-[#b7d09a] content-stretch flex items-center justify-center relative rounded-[8px] shrink-0 size-[32px]" data-name="Background">
      <Svg9 />
    </div>
  );
}

function Container23() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container22 />
      <Background />
    </div>
  );
}

function Svg10() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container24() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-emerald-600 w-[82.25px]">
        <p className="leading-[16.5px]">+12% this month</p>
      </div>
    </div>
  );
}

function Container25() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Container">
      <Svg10 />
      <Container24 />
    </div>
  );
}

function Container26() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[80.09px]">
        <p className="leading-[16.5px]">vs 28 last month</p>
      </div>
    </div>
  );
}

function Container27() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container25 />
      <Container26 />
    </div>
  );
}

function Article() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[8px] items-start p-[17px] relative rounded-[12px] self-stretch shrink-0 w-[232px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Container23 />
      <Container27 />
    </div>
  );
}

function Container28() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.76px] uppercase w-[135.41px]">
        <p className="leading-[16.5px]">Monthly revenue</p>
      </div>
    </div>
  );
}

function Container29() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-neutral-50 tracking-[-0.6px] w-[82.56px]">
        <p className="leading-[32px]">$38,420</p>
      </div>
    </div>
  );
}

function Margin1() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container29 />
    </div>
  );
}

function Container30() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container28 />
      <Margin1 />
    </div>
  );
}

function Svg11() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Background1() {
  return (
    <div className="bg-[#7c995c] content-stretch flex items-center justify-center relative rounded-[8px] shrink-0 size-[32px]" data-name="Background">
      <Svg11 />
    </div>
  );
}

function Container31() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container30 />
      <Background1 />
    </div>
  );
}

function Svg12() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container32() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-emerald-600 w-[59px]">
        <p className="leading-[16.5px]">+8.4% MoM</p>
      </div>
    </div>
  );
}

function Container33() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Container">
      <Svg12 />
      <Container32 />
    </div>
  );
}

function Container34() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[74.61px]">
        <p className="leading-[16.5px]">{`invoiced & paid`}</p>
      </div>
    </div>
  );
}

function Container35() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container33 />
      <Container34 />
    </div>
  );
}

function Article1() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[8px] items-start p-[17px] relative rounded-[12px] self-stretch shrink-0 w-[232px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Container31 />
      <Container35 />
    </div>
  );
}

function Container36() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.76px] uppercase w-[115.8px]">
        <p className="leading-[16.5px]">Open projects</p>
      </div>
    </div>
  );
}

function Container37() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-neutral-50 tracking-[-0.6px] w-[25.5px]">
        <p className="leading-[32px]">14</p>
      </div>
    </div>
  );
}

function Margin2() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container37 />
    </div>
  );
}

function Container38() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container36 />
      <Margin2 />
    </div>
  );
}

function Svg13() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Background2() {
  return (
    <div className="bg-[#b7d09a] content-stretch flex items-center justify-center relative rounded-[8px] shrink-0 size-[32px]" data-name="Background">
      <Svg13 />
    </div>
  );
}

function Container39() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container38 />
      <Background2 />
    </div>
  );
}

function Container40() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[76.44px]">
        <p className="leading-[16.5px]">6 due this week</p>
      </div>
    </div>
  );
}

function Svg14() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container41() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-amber-600 w-[38.52px]">
        <p className="leading-[16.5px]">2 at risk</p>
      </div>
    </div>
  );
}

function Container42() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Container">
      <Svg14 />
      <Container41 />
    </div>
  );
}

function Container43() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container40 />
      <Container42 />
    </div>
  );
}

function Article2() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[8px] items-start p-[17px] relative rounded-[12px] self-stretch shrink-0 w-[232px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Container39 />
      <Container43 />
    </div>
  );
}

function Container44() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] tracking-[1.76px] uppercase w-[128.48px]">
        <p className="leading-[16.5px]">Weekly capacity</p>
      </div>
    </div>
  );
}

function Container45() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[24px] text-neutral-50 tracking-[-0.6px] w-[46.25px]">
        <p className="leading-[32px]">82%</p>
      </div>
    </div>
  );
}

function Margin3() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container45 />
    </div>
  );
}

function Container46() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container44 />
      <Margin3 />
    </div>
  );
}

function Svg15() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Background3() {
  return (
    <div className="bg-[#7c995c] content-stretch flex items-center justify-center relative rounded-[8px] shrink-0 size-[32px]" data-name="Background">
      <Svg15 />
    </div>
  );
}

function Container47() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container46 />
      <Background3 />
    </div>
  );
}

function Container48() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[50.77px]">
        <p className="leading-[16.5px]">Team load</p>
      </div>
    </div>
  );
}

function Svg16() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container49() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-emerald-600 w-[57.17px]">
        <p className="leading-[16.5px]">+4% vs avg</p>
      </div>
    </div>
  );
}

function Container50() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Container">
      <Svg16 />
      <Container49 />
    </div>
  );
}

function Container51() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <Container48 />
          <Container50 />
        </div>
      </div>
    </div>
  );
}

function Article3() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[8px] items-start p-[17px] relative rounded-[12px] self-stretch shrink-0 w-[232px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Container47 />
      <Container51 />
    </div>
  );
}

function Section() {
  return (
    <div className="content-stretch flex gap-[16px] items-start justify-center relative shrink-0 w-full" data-name="Section">
      <Article />
      <Article1 />
      <Article2 />
      <Article3 />
    </div>
  );
}

function Heading() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[92.7px]">
        <p className="leading-[20px]">Revenue trend</p>
      </div>
    </div>
  );
}

function Container52() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[167.55px]">
        <p className="leading-[16.5px]">Last 6 months of invoiced revenue</p>
      </div>
    </div>
  );
}

function Container53() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading />
      <Container52 />
    </div>
  );
}

function Svg17() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container54() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[29.95px]">
        <p className="leading-[16.5px]">Filters</p>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg17 />
      <Container54 />
    </div>
  );
}

function Container55() {
  return (
    <div className="box-border content-stretch flex flex-col items-start overflow-clip pl-0 pr-[6.91px] py-px relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[69.09px]">
        <p className="leading-[12px]">Last 6 months</p>
      </div>
    </div>
  );
}

function Options() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex flex-col items-start justify-center pl-[13px] pr-[25px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Options">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Container55 />
    </div>
  );
}

function Container56() {
  return (
    <div className="content-stretch flex gap-[8.01px] items-center relative shrink-0" data-name="Container">
      <Button />
      <Options />
    </div>
  );
}

function Header() {
  return (
    <div className="relative shrink-0 w-full" data-name="Header">
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex items-center justify-between pl-0 pr-[0.01px] py-0 relative w-full">
          <Container53 />
          <Container56 />
        </div>
      </div>
    </div>
  );
}

function Container57() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[18.91px]">
        <p className="leading-[15px]">May</p>
      </div>
    </div>
  );
}

function Container58() {
  return (
    <div className="box-border content-stretch flex flex-col items-center pb-0 pt-[4px] px-0 relative shrink-0 w-[90.11px]" data-name="Container">
      <Container57 />
    </div>
  );
}

function Container59() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[16.13px]">
        <p className="leading-[15px]">Jun</p>
      </div>
    </div>
  );
}

function Container60() {
  return (
    <div className="box-border content-stretch flex flex-col items-center pb-0 pt-[4px] px-0 relative shrink-0 w-[90.11px]" data-name="Container">
      <Container59 />
    </div>
  );
}

function Container61() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[12.8px]">
        <p className="leading-[15px]">Jul</p>
      </div>
    </div>
  );
}

function Container62() {
  return (
    <div className="box-border content-stretch flex flex-col items-center pb-0 pt-[4px] px-0 relative shrink-0 w-[90.11px]" data-name="Container">
      <Container61 />
    </div>
  );
}

function Container63() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[17.8px]">
        <p className="leading-[15px]">Aug</p>
      </div>
    </div>
  );
}

function Container64() {
  return (
    <div className="box-border content-stretch flex flex-col items-center pb-0 pt-[4px] px-0 relative shrink-0 w-[90.11px]" data-name="Container">
      <Container63 />
    </div>
  );
}

function Container65() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[17.8px]">
        <p className="leading-[15px]">Sep</p>
      </div>
    </div>
  );
}

function Container66() {
  return (
    <div className="box-border content-stretch flex flex-col items-center pb-0 pt-[4px] px-0 relative shrink-0 w-[90.11px]" data-name="Container">
      <Container65 />
    </div>
  );
}

function Container67() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[15.56px]">
        <p className="leading-[15px]">Oct</p>
      </div>
    </div>
  );
}

function Container68() {
  return (
    <div className="box-border content-stretch flex flex-col items-center pb-0 pt-[4px] px-0 relative shrink-0 w-[90.11px]" data-name="Container">
      <Container67 />
    </div>
  );
}

function Container69() {
  return (
    <div className="content-stretch flex gap-[12px] h-[160px] items-end justify-center relative shrink-0 w-full" data-name="Container">
      <Container58 />
      <Container60 />
      <Container62 />
      <Container64 />
      <Container66 />
      <Container68 />
    </div>
  );
}

function Term() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[63.39px]">
        <p className="leading-[16.5px]">Avg. monthly</p>
      </div>
    </div>
  );
}

function Details() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[39.77px]">
        <p className="leading-[16.5px]">$31,240</p>
      </div>
    </div>
  );
}

function Container70() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0 w-[141.16px]" data-name="Container">
      <Term />
      <Details />
    </div>
  );
}

function Term1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[55.64px]">
        <p className="leading-[16.5px]">Best month</p>
      </div>
    </div>
  );
}

function Details1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[69.72px]">
        <p className="leading-[16.5px]">$42,180 (Sep)</p>
      </div>
    </div>
  );
}

function Container71() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0 w-[141.17px]" data-name="Container">
      <Term1 />
      <Details1 />
    </div>
  );
}

function Term2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[61.13px]">
        <p className="leading-[16.5px]">Growth (6m)</p>
      </div>
    </div>
  );
}

function Details2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-emerald-600 w-[37.63px]">
        <p className="leading-[16.5px]">+18.2%</p>
      </div>
    </div>
  );
}

function Container72() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0 w-[141.16px]" data-name="Container">
      <Term2 />
      <Details2 />
    </div>
  );
}

function Term3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[66.64px]">
        <p className="leading-[16.5px]">Forecast next</p>
      </div>
    </div>
  );
}

function Details3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[39.77px]">
        <p className="leading-[16.5px]">$39,800</p>
      </div>
    </div>
  );
}

function Container73() {
  return (
    <div className="content-stretch flex flex-col items-start relative self-stretch shrink-0 w-[141.17px]" data-name="Container">
      <Term3 />
      <Details3 />
    </div>
  );
}

function Descriptions() {
  return (
    <div className="content-stretch flex gap-[12px] items-start justify-center relative shrink-0 w-full" data-name="Descriptions">
      <Container70 />
      <Container71 />
      <Container72 />
      <Container73 />
    </div>
  );
}

function Container74() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-name="Container">
      <Container69 />
      <Descriptions />
    </div>
  );
}

function Article4() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[16px] items-start p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[642.66px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Header />
      <Container74 />
    </div>
  );
}

function Heading1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[98.66px]">
        <p className="leading-[20px]">Project pipeline</p>
      </div>
    </div>
  );
}

function Container75() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[93.55px]">
        <p className="leading-[16.5px]">Key studio streams</p>
      </div>
    </div>
  );
}

function Container76() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading1 />
      <Container75 />
    </div>
  );
}

function Svg18() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container77() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[19.58px]">
        <p className="leading-[16.5px]">Add</p>
      </div>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg18 />
      <Container77 />
    </div>
  );
}

function Header1() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Header">
      <Container76 />
      <Button1 />
    </div>
  );
}

function Container78() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 w-[191.44px]">
        <p className="leading-[16px]">{`Brand & site refresh – Atelier No. 14`}</p>
      </div>
    </div>
  );
}

function Container79() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[137.38px]">
        <p className="leading-[16.5px]">{`Design & Web · Due Nov 28`}</p>
      </div>
    </div>
  );
}

function Margin4() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[2px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container79 />
    </div>
  );
}

function Svg19() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Background4() {
  return (
    <div className="bg-[#3d3d3d] box-border content-stretch flex gap-[4px] items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <Svg19 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[50.03px]">
        <p className="leading-[15px]">In progress</p>
      </div>
    </div>
  );
}

function Background5() {
  return (
    <div className="bg-emerald-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-emerald-700 w-[45.05px]">
        <p className="leading-[15px]">68% done</p>
      </div>
    </div>
  );
}

function Container80() {
  return (
    <div className="content-stretch flex gap-[6px] items-center relative shrink-0 w-full" data-name="Container">
      <Background4 />
      <Background5 />
    </div>
  );
}

function Margin5() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[8px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container80 />
    </div>
  );
}

function Container81() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container78 />
      <Margin4 />
      <Margin5 />
    </div>
  );
}

function Svg20() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function ButtonProjectMenu() {
  return (
    <div className="content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Button - Project menu">
      <Svg20 />
    </div>
  );
}

function Item() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Item">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex items-start justify-between px-[13px] py-[11px] relative w-full">
          <Container81 />
          <ButtonProjectMenu />
        </div>
      </div>
    </div>
  );
}

function Container82() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 w-[201.44px]">
        <p className="leading-[16px]">Editorial identity – Field Notes Journal</p>
      </div>
    </div>
  );
}

function Container83() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[90.5px]">
        <p className="leading-[16.5px]">Brand · Due Dec 5</p>
      </div>
    </div>
  );
}

function Margin6() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[2px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container83 />
    </div>
  );
}

function Svg21() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Background6() {
  return (
    <div className="bg-[#3d3d3d] box-border content-stretch flex gap-[4px] items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <Svg21 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[43.91px]">
        <p className="leading-[15px]">Discovery</p>
      </div>
    </div>
  );
}

function Background7() {
  return (
    <div className="bg-amber-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-amber-700 w-[90.61px]">
        <p className="leading-[15px]">Hold – awaiting brief</p>
      </div>
    </div>
  );
}

function Container84() {
  return (
    <div className="content-stretch flex gap-[5.99px] items-center relative shrink-0 w-full" data-name="Container">
      <Background6 />
      <Background7 />
    </div>
  );
}

function Margin7() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[8px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container84 />
    </div>
  );
}

function Container85() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container82 />
      <Margin6 />
      <Margin7 />
    </div>
  );
}

function Svg22() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function ButtonProjectMenu1() {
  return (
    <div className="content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Button - Project menu">
      <Svg22 />
    </div>
  );
}

function Item1() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Item">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex items-start justify-between px-[13px] py-[11px] relative w-full">
          <Container85 />
          <ButtonProjectMenu1 />
        </div>
      </div>
    </div>
  );
}

function Container86() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[5.77px] py-0 relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[33px] justify-center leading-[16.5px] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[189.56px]">
        <p className="mb-0">Add a new project to track in the studio</p>
        <p>pipeline.</p>
      </div>
    </div>
  );
}

function Svg23() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container87() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[22.02px]">
        <p className="leading-[16.5px]">New</p>
      </div>
    </div>
  );
}

function Container88() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Container">
      <Svg23 />
      <Container87 />
    </div>
  );
}

function Item2() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-dashed inset-0 pointer-events-none rounded-[8px]" />
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex items-center justify-between px-[13px] py-[11px] relative w-full">
          <Container86 />
          <Container88 />
        </div>
      </div>
    </div>
  );
}

function List3() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="List">
      <Item />
      <Item1 />
      <Item2 />
    </div>
  );
}

function Article5() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[309.34px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Header1 />
      <List3 />
    </div>
  );
}

function Section1() {
  return (
    <div className="content-stretch flex gap-[24px] items-start justify-center relative shrink-0 w-full" data-name="Section">
      <Article4 />
      <Article5 />
    </div>
  );
}

function Heading2() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[97.47px]">
        <p className="leading-[20px]">Client overview</p>
      </div>
    </div>
  );
}

function Container89() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[157.77px]">
        <p className="leading-[16.5px]">Key accounts and current health</p>
      </div>
    </div>
  );
}

function Container90() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading2 />
      <Container89 />
    </div>
  );
}

function Svg24() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container91() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[44.03px]">
        <p className="leading-[16.5px]">Segment</p>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg24 />
      <Container91 />
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#9ae83e] box-border content-stretch flex items-center justify-center px-[10px] py-[4px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#1a1a1a] text-[11px] text-center w-[50.75px]">
        <p className="leading-[16.5px]">New client</p>
      </div>
    </div>
  );
}

function Container92() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0" data-name="Container">
      <Button2 />
      <Button3 />
    </div>
  );
}

function Header2() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Header">
      <Container90 />
      <Container92 />
    </div>
  );
}

function Cell() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-px pr-[16px] py-[8px] relative shrink-0 w-[157.45px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[28.13px]">
        <p className="leading-[normal]">Client</p>
      </div>
    </div>
  );
}

function Cell1() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[8px] relative shrink-0 w-[128.53px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[31.19px]">
        <p className="leading-[normal]">Status</p>
      </div>
    </div>
  );
}

function Cell2() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[8px] relative shrink-0 w-[87.97px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[39.75px]">
        <p className="leading-[normal]">Projects</p>
      </div>
    </div>
  );
}

function Cell3() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[8px] relative shrink-0 w-[71.89px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[25.06px]">
        <p className="leading-[normal]">MRR</p>
      </div>
    </div>
  );
}

function Cell4() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[8px] relative shrink-0 w-[154.81px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] text-right w-[57.47px]">
        <p className="leading-[normal]">Last activity</p>
      </div>
    </div>
  );
}

function Row() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Row">
      <Cell />
      <Cell1 />
      <Cell2 />
      <Cell3 />
      <Cell4 />
    </div>
  );
}

function Header3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Header">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <Row />
    </div>
  );
}

function Container93() {
  return (
    <div className="content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#9ae83e] text-[10px] text-center w-[14.45px]">
        <p className="leading-[normal]">AN</p>
      </div>
    </div>
  );
}

function Container94() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[66.66px]">
        <p className="leading-[normal]">Atelier No. 14</p>
      </div>
    </div>
  );
}

function Container95() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[57.27px]">
        <p className="leading-[normal]">{`Brand & web`}</p>
      </div>
    </div>
  );
}

function Container96() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container94 />
      <Container95 />
    </div>
  );
}

function Data() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-[140.45px]" data-name="Data">
      <Container93 />
      <Container96 />
    </div>
  );
}

function Background8() {
  return (
    <div className="bg-emerald-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-emerald-700 w-[73.38px]">
        <p className="leading-[normal]">Active · Retainer</p>
      </div>
    </div>
  );
}

function Data1() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[15px] relative shrink-0 w-[128.53px]" data-name="Data">
      <Background8 />
    </div>
  );
}

function Data2() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[16px] py-[16.5px] relative shrink-0 w-[71.97px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[48.33px]">
        <p className="leading-[normal]">3 ongoing</p>
      </div>
    </div>
  );
}

function Data3() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[16px] py-[16.5px] relative shrink-0 w-[55.89px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[33.66px]">
        <p className="leading-[normal]">$4,800</p>
      </div>
    </div>
  );
}

function Data4() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[17px] relative shrink-0 w-[138.81px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[97.47px]">
        <p className="leading-[normal]">Yesterday · Call recap</p>
      </div>
    </div>
  );
}

function Row1() {
  return (
    <div className="relative shrink-0 w-full" data-name="Row">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="box-border content-stretch flex gap-[16px] items-center justify-center pl-px pr-[0.01px] py-0 relative w-full">
          <Data />
          <Data1 />
          <Data2 />
          <Data3 />
          <Data4 />
        </div>
      </div>
    </div>
  );
}

function Background9() {
  return (
    <div className="bg-amber-100 content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-amber-700 text-center w-[13.34px]">
        <p className="leading-[normal]">FN</p>
      </div>
    </div>
  );
}

function Container97() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[94.78px]">
        <p className="leading-[normal]">Field Notes Journal</p>
      </div>
    </div>
  );
}

function Container98() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[70.59px]">
        <p className="leading-[normal]">Editorial identity</p>
      </div>
    </div>
  );
}

function Container99() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container97 />
      <Container98 />
    </div>
  );
}

function Data5() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-[140.45px]" data-name="Data">
      <Background9 />
      <Container99 />
    </div>
  );
}

function Background10() {
  return (
    <div className="bg-amber-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-amber-700 w-[35.03px]">
        <p className="leading-[normal]">On hold</p>
      </div>
    </div>
  );
}

function Data6() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[15px] relative shrink-0 w-[128.53px]" data-name="Data">
      <Background10 />
    </div>
  );
}

function Data7() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[16px] py-[16.5px] relative shrink-0 w-[71.97px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[44.66px]">
        <p className="leading-[normal]">1 scoped</p>
      </div>
    </div>
  );
}

function Data8() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[16px] py-[16.5px] relative shrink-0 w-[55.89px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[33.66px]">
        <p className="leading-[normal]">$1,200</p>
      </div>
    </div>
  );
}

function Data9() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[17px] relative shrink-0 w-[138.81px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[110.08px]">
        <p className="leading-[normal]">3 days ago · Proposal v2</p>
      </div>
    </div>
  );
}

function Row2() {
  return (
    <div className="relative shrink-0 w-full" data-name="Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="box-border content-stretch flex gap-[16px] items-center justify-center pl-px pr-[0.01px] py-0 relative w-full">
          <Data5 />
          <Data6 />
          <Data7 />
          <Data8 />
          <Data9 />
        </div>
      </div>
    </div>
  );
}

function Background11() {
  return (
    <div className="bg-sky-100 content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-center text-sky-700 w-[13.34px]">
        <p className="leading-[normal]">LN</p>
      </div>
    </div>
  );
}

function Container100() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[67.89px]">
        <p className="leading-[normal]">{`Linen & Loom`}</p>
      </div>
    </div>
  );
}

function Container101() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[56.69px]">
        <p className="leading-[normal]">E‑commerce</p>
      </div>
    </div>
  );
}

function Container102() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container100 />
      <Container101 />
    </div>
  );
}

function Data10() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-[140.45px]" data-name="Data">
      <Background11 />
      <Container102 />
    </div>
  );
}

function Background12() {
  return (
    <div className="bg-emerald-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-emerald-700 w-[27.23px]">
        <p className="leading-[normal]">Active</p>
      </div>
    </div>
  );
}

function Data11() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[15px] relative shrink-0 w-[128.53px]" data-name="Data">
      <Background12 />
    </div>
  );
}

function Data12() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[16px] py-[16.5px] relative shrink-0 w-[71.97px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[48.33px]">
        <p className="leading-[normal]">2 ongoing</p>
      </div>
    </div>
  );
}

function Data13() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-0 pr-[16px] py-[16.5px] relative shrink-0 w-[55.89px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[33.66px]">
        <p className="leading-[normal]">$3,100</p>
      </div>
    </div>
  );
}

function Data14() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[17px] relative shrink-0 w-[138.81px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[91.16px]">
        <p className="leading-[normal]">Today · Asset review</p>
      </div>
    </div>
  );
}

function Row3() {
  return (
    <div className="relative shrink-0 w-full" data-name="Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="box-border content-stretch flex gap-[16px] items-center justify-center pl-px pr-[0.01px] py-0 relative w-full">
          <Data10 />
          <Data11 />
          <Data12 />
          <Data13 />
          <Data14 />
        </div>
      </div>
    </div>
  );
}

function Background13() {
  return (
    <div className="bg-slate-200 content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-center text-slate-700 w-[14.45px]">
        <p className="leading-[normal]">AR</p>
      </div>
    </div>
  );
}

function Container103() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[70.94px]">
        <p className="leading-[normal]">Archive Studio</p>
      </div>
    </div>
  );
}

function Container104() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[61.52px]">
        <p className="leading-[normal]">Visual system</p>
      </div>
    </div>
  );
}

function Container105() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container103 />
      <Container104 />
    </div>
  );
}

function Data15() {
  return (
    <div className="content-stretch flex gap-[8px] items-center relative shrink-0 w-[140.45px]" data-name="Data">
      <Background13 />
      <Container105 />
    </div>
  );
}

function Background14() {
  return (
    <div className="bg-zinc-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-zinc-700 w-[38.36px]">
        <p className="leading-[normal]">Dormant</p>
      </div>
    </div>
  );
}

function Data16() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[14.5px] pt-[15px] px-[16px] relative shrink-0 w-[128.53px]" data-name="Data">
      <Background14 />
    </div>
  );
}

function Data17() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[16px] pl-0 pr-[16px] pt-[16.5px] relative shrink-0 w-[71.97px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[11px]">
        <p className="leading-[normal]">—</p>
      </div>
    </div>
  );
}

function Data18() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[16px] pl-0 pr-[16px] pt-[16.5px] relative shrink-0 w-[55.89px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[12.25px]">
        <p className="leading-[normal]">$0</p>
      </div>
    </div>
  );
}

function Data19() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pb-[16.5px] pl-[16px] pr-px pt-[17px] relative shrink-0 w-[138.81px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[124.34px]">
        <p className="leading-[normal]">2 months ago · Off‑boarding</p>
      </div>
    </div>
  );
}

function Row4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="box-border content-stretch flex gap-[16px] items-center justify-center pl-px pr-[0.01px] py-0 relative w-full">
          <Data15 />
          <Data16 />
          <Data17 />
          <Data18 />
          <Data19 />
        </div>
      </div>
    </div>
  );
}

function Body() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Body">
      <Row1 />
      <Row2 />
      <Row3 />
      <Row4 />
    </div>
  );
}

function Table() {
  return (
    <div className="content-stretch flex flex-col items-start min-w-[600.66px] relative shrink-0" data-name="Table">
      <Header3 />
      <Body />
    </div>
  );
}

function Container106() {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip relative shrink-0 w-full" data-name="Container">
      <Table />
    </div>
  );
}

function Container107() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[131.75px]">
        <p className="leading-[15px]">Showing 4 of 32 active clients</p>
      </div>
    </div>
  );
}

function Container108() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-center w-[34.28px]">
        <p className="leading-[15px]">View all</p>
      </div>
    </div>
  );
}

function Svg25() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Button4() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Button">
      <Container108 />
      <Svg25 />
    </div>
  );
}

function Footer() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Footer">
      <Container107 />
      <Button4 />
    </div>
  );
}

function Article6() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[642.66px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Header2 />
      <Container106 />
      <Footer />
    </div>
  );
}

function Heading3() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[86.5px]">
        <p className="leading-[20px]">Today’s tasks</p>
      </div>
    </div>
  );
}

function Container109() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[124.13px]">
        <p className="leading-[16.5px]">Focus for the studio team</p>
      </div>
    </div>
  );
}

function Container110() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading3 />
      <Container109 />
    </div>
  );
}

function Svg26() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container111() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[19.58px]">
        <p className="leading-[16.5px]">Add</p>
      </div>
    </div>
  );
}

function Button5() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg26 />
      <Container111 />
    </div>
  );
}

function Header4() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Header">
      <Container110 />
      <Button5 />
    </div>
  );
}

function InputMarkTaskCompleteMargin() {
  return (
    <div className="box-border content-stretch flex flex-col h-[16px] items-start pb-0 pt-[2px] px-0 relative shrink-0 w-[14px]" data-name="Input - Mark task complete:margin">
      <div className="bg-white relative rounded-[2.5px] shrink-0 size-[14px]" data-name="Input - Mark task complete">
        <div aria-hidden="true" className="absolute border border-[#767676] border-solid inset-0 pointer-events-none rounded-[2.5px]" />
      </div>
    </div>
  );
}

function Container112() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[16.5px] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[163.28px]">
        <p className="mb-0">Prepare Atelier No. 14 homepage</p>
        <p>concepts</p>
      </div>
    </div>
  );
}

function Container113() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[131.77px]">
        <p className="leading-[15px]">Due 14:00 · Assigned to Sako</p>
      </div>
    </div>
  );
}

function Margin8() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[2px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container113 />
    </div>
  );
}

function Container114() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[178.77px]" data-name="Container">
      <Container112 />
      <Margin8 />
    </div>
  );
}

function Background15() {
  return (
    <div className="bg-emerald-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-emerald-700 w-[20.58px]">
        <p className="leading-[15px]">High</p>
      </div>
    </div>
  );
}

function Margin9() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-[4px] pr-0 py-0 relative shrink-0" data-name="Margin">
      <Background15 />
    </div>
  );
}

function Item3() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Item">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex gap-[8px] items-start px-[11px] py-[9px] relative w-full">
          <InputMarkTaskCompleteMargin />
          <Container114 />
          <Margin9 />
        </div>
      </div>
    </div>
  );
}

function InputMarkTaskCompleteMargin1() {
  return (
    <div className="box-border content-stretch flex flex-col h-[16px] items-start pb-0 pt-[2px] px-0 relative shrink-0 w-[14px]" data-name="Input - Mark task complete:margin">
      <div className="bg-white relative rounded-[2.5px] shrink-0 size-[14px]" data-name="Input - Mark task complete">
        <div aria-hidden="true" className="absolute border border-[#767676] border-solid inset-0 pointer-events-none rounded-[2.5px]" />
      </div>
    </div>
  );
}

function Container115() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[144.31px]">
        <p className="leading-[16.5px]">Send Field Notes proposal v3</p>
      </div>
    </div>
  );
}

function Container116() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[15px] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[148.43px]">
        <p className="mb-0">Before 17:00 · Assigned to Studio</p>
        <p>Ops</p>
      </div>
    </div>
  );
}

function Margin10() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[2px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container116 />
    </div>
  );
}

function Container117() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[163.77px]" data-name="Container">
      <Container115 />
      <Margin10 />
    </div>
  );
}

function Background16() {
  return (
    <div className="bg-amber-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-amber-700 w-[35.58px]">
        <p className="leading-[15px]">Medium</p>
      </div>
    </div>
  );
}

function Margin11() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-[4px] pr-0 py-0 relative shrink-0" data-name="Margin">
      <Background16 />
    </div>
  );
}

function Item4() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Item">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex gap-[8px] items-start px-[11px] py-[9px] relative w-full">
          <InputMarkTaskCompleteMargin1 />
          <Container117 />
          <Margin11 />
        </div>
      </div>
    </div>
  );
}

function Svg27() {
  return <div className="shrink-0 size-[10px]" data-name="SVG" />;
}

function Border() {
  return (
    <div className="box-border content-stretch flex items-center justify-center p-px relative rounded-[4px] shrink-0 size-[14px]" data-name="Border">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <Svg27 />
    </div>
  );
}

function Item5() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Item">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-dashed inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex gap-[8px] items-start px-[11px] py-[9px] relative w-full">
          <Border />
          <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[130.03px]">
            <p className="leading-[16.5px]">Quick add a task for today.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function List4() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full" data-name="List">
      <Item3 />
      <Item4 />
      <Item5 />
    </div>
  );
}

function Article7() {
  return (
    <div className="bg-[#1a1a1a] relative rounded-[12px] shrink-0 w-full" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative w-full">
          <Header4 />
          <List4 />
        </div>
      </div>
    </div>
  );
}

function Heading4() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[59.45px]">
        <p className="leading-[20px]">Schedule</p>
      </div>
    </div>
  );
}

function Container118() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[154.7px]">
        <p className="leading-[16.5px]">Next 24 hours across the studio</p>
      </div>
    </div>
  );
}

function Container119() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading4 />
      <Container118 />
    </div>
  );
}

function Svg28() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container120() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[52.39px]">
        <p className="leading-[16.5px]">View week</p>
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg28 />
      <Container120 />
    </div>
  );
}

function Header5() {
  return (
    <div className="relative shrink-0 w-full" data-name="Header">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <Container119 />
          <Button6 />
        </div>
      </div>
    </div>
  );
}

function Container121() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[77.06px]">
        <p className="leading-[16.5px]">Studio stand‑up</p>
      </div>
    </div>
  );
}

function Container122() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[55.63px]">
        <p className="leading-[15px]">09:30–09:50</p>
      </div>
    </div>
  );
}

function Container123() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container121 />
      <Container122 />
    </div>
  );
}

function Container124() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[94.5px]">
        <p className="leading-[15px]">Daily sync · All hands</p>
      </div>
    </div>
  );
}

function BackgroundBorder() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[2px] items-start px-[11px] py-[9px] relative w-full">
          <Container123 />
          <Container124 />
        </div>
      </div>
    </div>
  );
}

function Item6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Item">
      <BackgroundBorder />
      <div className="absolute bg-emerald-500 left-[-7px] rounded-[9999px] size-[12px] top-[6px]" data-name="Background+Border+Shadow">
        <div aria-hidden="true" className="absolute border-2 border-[#1b1b1b] border-solid inset-0 pointer-events-none rounded-[9999px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
      </div>
    </div>
  );
}

function Container125() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[101.5px]">
        <p className="leading-[16.5px]">Atelier No. 14 review</p>
      </div>
    </div>
  );
}

function Container126() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[55.63px]">
        <p className="leading-[15px]">11:00–12:00</p>
      </div>
    </div>
  );
}

function Container127() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container125 />
      <Container126 />
    </div>
  );
}

function Container128() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[135.64px]">
        <p className="leading-[15px]">Design presentation with client</p>
      </div>
    </div>
  );
}

function BackgroundBorder1() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[2px] items-start px-[11px] py-[9px] relative w-full">
          <Container127 />
          <Container128 />
        </div>
      </div>
    </div>
  );
}

function Item7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Item">
      <BackgroundBorder1 />
      <div className="absolute bg-[#9ae83e] left-[-7px] rounded-[9999px] size-[12px] top-[6px]" data-name="Background+Border+Shadow">
        <div aria-hidden="true" className="absolute border-2 border-[#1b1b1b] border-solid inset-0 pointer-events-none rounded-[9999px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
      </div>
    </div>
  );
}

function Container129() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[109.45px]">
        <p className="leading-[16.5px]">{`Finance & billing block`}</p>
      </div>
    </div>
  );
}

function Container130() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[55.63px]">
        <p className="leading-[15px]">15:00–16:00</p>
      </div>
    </div>
  );
}

function Container131() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container129 />
      <Container130 />
    </div>
  );
}

function Container132() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[150.08px]">
        <p className="leading-[15px]">Reconcile invoices · Prep payouts</p>
      </div>
    </div>
  );
}

function BackgroundBorder2() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[2px] items-start px-[11px] py-[9px] relative w-full">
          <Container131 />
          <Container132 />
        </div>
      </div>
    </div>
  );
}

function Item8() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Item">
      <BackgroundBorder2 />
      <div className="absolute bg-amber-500 left-[-7px] rounded-[9999px] size-[12px] top-[6px]" data-name="Background+Border+Shadow">
        <div aria-hidden="true" className="absolute border-2 border-[#1b1b1b] border-solid inset-0 pointer-events-none rounded-[9999px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
      </div>
    </div>
  );
}

function Container133() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[100.28px]">
        <p className="leading-[16.5px]">Open focus time slot</p>
      </div>
    </div>
  );
}

function Container134() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[86.72px]">
        <p className="leading-[15px]">Anytime after 16:00</p>
      </div>
    </div>
  );
}

function Container135() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container133 />
      <Container134 />
    </div>
  );
}

function Border1() {
  return (
    <div className="relative rounded-[8px] shrink-0 w-full" data-name="Border">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-dashed inset-0 pointer-events-none rounded-[8px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col items-start px-[11px] py-[9px] relative w-full">
          <Container135 />
        </div>
      </div>
    </div>
  );
}

function Item9() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Item">
      <Border1 />
      <div className="absolute bg-zinc-400 left-[-7px] rounded-[9999px] size-[12px] top-[6px]" data-name="Background+Border+Shadow">
        <div aria-hidden="true" className="absolute border-2 border-[#1b1b1b] border-solid inset-0 pointer-events-none rounded-[9999px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]" />
      </div>
    </div>
  );
}

function OrderedList() {
  return (
    <div className="relative shrink-0 w-full" data-name="Ordered List">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[0px_0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[12px] items-start pl-[13px] pr-0 py-0 relative w-full">
          <Item6 />
          <Item7 />
          <Item8 />
          <Item9 />
        </div>
      </div>
    </div>
  );
}

function Article8() {
  return (
    <div className="bg-[#1a1a1a] relative rounded-[12px] shrink-0 w-full" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="size-full">
        <div className="box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative w-full">
          <Header5 />
          <OrderedList />
        </div>
      </div>
    </div>
  );
}

function Container136() {
  return (
    <div className="content-stretch flex flex-col gap-[20px] items-start relative self-stretch shrink-0 w-[309.34px]" data-name="Container">
      <Article7 />
      <Article8 />
    </div>
  );
}

function Section2() {
  return (
    <div className="content-stretch flex gap-[24px] items-start justify-center relative shrink-0 w-full" data-name="Section">
      <Article6 />
      <Container136 />
    </div>
  );
}

function Heading5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[103.67px]">
        <p className="leading-[20px]">Billing summary</p>
      </div>
    </div>
  );
}

function Container137() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[139.42px]">
        <p className="leading-[16.5px]">Invoices and payment status</p>
      </div>
    </div>
  );
}

function Container138() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading5 />
      <Container137 />
    </div>
  );
}

function Svg29() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container139() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[31.8px]">
        <p className="leading-[16.5px]">Export</p>
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg29 />
      <Container139 />
    </div>
  );
}

function Header6() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Header">
      <Container138 />
      <Button7 />
    </div>
  );
}

function Cell5() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-px pr-[16px] py-[8px] relative shrink-0 w-[77.67px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[34.86px]">
        <p className="leading-[normal]">Invoice</p>
      </div>
    </div>
  );
}

function Cell6() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[8px] relative shrink-0 w-[171.7px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[28.13px]">
        <p className="leading-[normal]">Client</p>
      </div>
    </div>
  );
}

function Cell7() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[8px] relative shrink-0 w-[94.69px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[37.92px]">
        <p className="leading-[normal]">Amount</p>
      </div>
    </div>
  );
}

function Cell8() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[8px] relative shrink-0 w-[111.53px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[31.19px]">
        <p className="leading-[normal]">Status</p>
      </div>
    </div>
  );
}

function Cell9() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[8px] relative shrink-0 w-[145.06px]" data-name="Cell">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] text-right w-[20.19px]">
        <p className="leading-[normal]">Due</p>
      </div>
    </div>
  );
}

function HeaderRow() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Header → Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <Cell5 />
      <Cell6 />
      <Cell7 />
      <Cell8 />
      <Cell9 />
    </div>
  );
}

function Data20() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-px pr-[16px] py-[12px] relative shrink-0 w-[77.67px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[40.36px]">
        <p className="leading-[normal]">INV‑204</p>
      </div>
    </div>
  );
}

function Data21() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[12px] relative shrink-0 w-[171.7px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[66.66px]">
        <p className="leading-[normal]">Atelier No. 14</p>
      </div>
    </div>
  );
}

function Data22() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[12px] relative shrink-0 w-[94.69px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[33.66px]">
        <p className="leading-[normal]">$6,800</p>
      </div>
    </div>
  );
}

function Background17() {
  return (
    <div className="bg-emerald-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-emerald-700 w-[20.02px]">
        <p className="leading-[normal]">Paid</p>
      </div>
    </div>
  );
}

function Data23() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[10.5px] relative shrink-0 w-[111.53px]" data-name="Data">
      <Background17 />
    </div>
  );
}

function Data24() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[12.5px] relative shrink-0 w-[145.06px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[23.91px]">
        <p className="leading-[normal]">Oct 2</p>
      </div>
    </div>
  );
}

function Row5() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Row">
      <Data20 />
      <Data21 />
      <Data22 />
      <Data23 />
      <Data24 />
    </div>
  );
}

function Data25() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-px pr-[16px] py-[12px] relative shrink-0 w-[77.67px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[40.36px]">
        <p className="leading-[normal]">INV‑205</p>
      </div>
    </div>
  );
}

function Data26() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[12px] relative shrink-0 w-[171.7px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[67.89px]">
        <p className="leading-[normal]">{`Linen & Loom`}</p>
      </div>
    </div>
  );
}

function Data27() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[12px] relative shrink-0 w-[94.69px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[33.66px]">
        <p className="leading-[normal]">$3,250</p>
      </div>
    </div>
  );
}

function Background18() {
  return (
    <div className="bg-amber-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-amber-700 w-[36.7px]">
        <p className="leading-[normal]">Pending</p>
      </div>
    </div>
  );
}

function Data28() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[10.5px] relative shrink-0 w-[111.53px]" data-name="Data">
      <Background18 />
    </div>
  );
}

function Data29() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pl-[16px] pr-px py-[12.5px] relative shrink-0 w-[145.06px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[31.69px]">
        <p className="leading-[normal]">Nov 21</p>
      </div>
    </div>
  );
}

function Row6() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <Data25 />
      <Data26 />
      <Data27 />
      <Data28 />
      <Data29 />
    </div>
  );
}

function Data30() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pl-px pr-[16px] py-[12px] relative shrink-0 w-[77.67px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[40.36px]">
        <p className="leading-[normal]">INV‑206</p>
      </div>
    </div>
  );
}

function Data31() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[12px] relative shrink-0 w-[171.7px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[94.78px]">
        <p className="leading-[normal]">Field Notes Journal</p>
      </div>
    </div>
  );
}

function Data32() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[12px] relative shrink-0 w-[94.69px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[33.66px]">
        <p className="leading-[normal]">$1,200</p>
      </div>
    </div>
  );
}

function Background19() {
  return (
    <div className="bg-rose-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-rose-700 w-[38.36px]">
        <p className="leading-[normal]">Overdue</p>
      </div>
    </div>
  );
}

function Data33() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[10.5px] relative shrink-0 w-[111.53px]" data-name="Data">
      <Background19 />
    </div>
  );
}

function Data34() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-px py-[12.5px] relative shrink-0 w-[145.06px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#f4212e] text-[10px] w-[105.08px]">
        <p className="leading-[normal]">Nov 3 · 7 days past due</p>
      </div>
    </div>
  );
}

function Row7() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <Data30 />
      <Data31 />
      <Data32 />
      <Data33 />
      <Data34 />
    </div>
  );
}

function Data35() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[11.5px] pl-px pr-[16px] pt-[12px] relative shrink-0 w-[77.67px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[40.36px]">
        <p className="leading-[normal]">INV‑207</p>
      </div>
    </div>
  );
}

function Data36() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[11.5px] pt-[12px] px-[16px] relative shrink-0 w-[171.7px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[70.94px]">
        <p className="leading-[normal]">Archive Studio</p>
      </div>
    </div>
  );
}

function Data37() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[11.5px] pt-[12px] px-[16px] relative shrink-0 w-[94.69px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[12px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[24.48px]">
        <p className="leading-[normal]">$950</p>
      </div>
    </div>
  );
}

function Background20() {
  return (
    <div className="bg-zinc-100 box-border content-stretch flex items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-zinc-700 w-[21.67px]">
        <p className="leading-[normal]">Draft</p>
      </div>
    </div>
  );
}

function Data38() {
  return (
    <div className="box-border content-stretch flex flex-col items-start px-[16px] py-[10px] relative shrink-0 w-[111.53px]" data-name="Data">
      <Background20 />
    </div>
  );
}

function Data39() {
  return (
    <div className="box-border content-stretch flex flex-col items-end pb-[12px] pl-[16px] pr-px pt-[12.5px] relative shrink-0 w-[145.06px]" data-name="Data">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[11px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-right w-[10px]">
        <p className="leading-[normal]">—</p>
      </div>
    </div>
  );
}

function Row8() {
  return (
    <div className="content-stretch flex items-start justify-center relative shrink-0 w-full" data-name="Row">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <Data35 />
      <Data36 />
      <Data37 />
      <Data38 />
      <Data39 />
    </div>
  );
}

function Body1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Body">
      <Row5 />
      <Row6 />
      <Row7 />
      <Row8 />
    </div>
  );
}

function Table1() {
  return (
    <div className="content-stretch flex flex-col items-start min-w-[600.66px] relative shrink-0" data-name="Table">
      <HeaderRow />
      <Body1 />
    </div>
  );
}

function Container140() {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip relative shrink-0 w-full" data-name="Container">
      <Table1 />
    </div>
  );
}

function Container141() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[132.34px]">
        <p className="leading-[15px]">
          <span>{`3 paid · 1 pending · `}</span>
          <span className="font-['Liberation_Sans:Regular',sans-serif] not-italic text-[#f4212e]">1 overdue</span>
        </p>
      </div>
    </div>
  );
}

function Container142() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] text-center w-[73.19px]">
        <p className="leading-[15px]">View all invoices</p>
      </div>
    </div>
  );
}

function Svg30() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Button8() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Button">
      <Container142 />
      <Svg30 />
    </div>
  );
}

function Footer1() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Footer">
      <Container141 />
      <Button8 />
    </div>
  );
}

function Article9() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[642.66px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Header6 />
      <Container140 />
      <Footer1 />
    </div>
  );
}

function Heading6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[122.41px]">
        <p className="leading-[20px]">Cashflow snapshot</p>
      </div>
    </div>
  );
}

function Container143() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[113.13px]">
        <p className="leading-[16.5px]">High‑level billing health</p>
      </div>
    </div>
  );
}

function Header7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Header">
      <Heading6 />
      <Container143 />
    </div>
  );
}

function HeaderMargin() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-[12px] pt-0 px-0 relative shrink-0 w-full" data-name="Header:margin">
      <Header7 />
    </div>
  );
}

function Term4() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[100.89px]">
        <p className="leading-[16.5px]">This month collected</p>
      </div>
    </div>
  );
}

function Details4() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[39.77px]">
        <p className="leading-[16.5px]">$28,900</p>
      </div>
    </div>
  );
}

function Container144() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Term4 />
      <Details4 />
    </div>
  );
}

function Term5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[59.33px]">
        <p className="leading-[16.5px]">Outstanding</p>
      </div>
    </div>
  );
}

function Details5() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-amber-600 w-[33.66px]">
        <p className="leading-[16.5px]">$4,450</p>
      </div>
    </div>
  );
}

function Container145() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <Term5 />
          <Details5 />
        </div>
      </div>
    </div>
  );
}

function Term6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[42.2px]">
        <p className="leading-[16.5px]">Overdue</p>
      </div>
    </div>
  );
}

function Details6() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-rose-600 w-[33.66px]">
        <p className="leading-[16.5px]">$1,200</p>
      </div>
    </div>
  );
}

function Container146() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <Term6 />
          <Details6 />
        </div>
      </div>
    </div>
  );
}

function Term7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Term">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[81.13px]">
        <p className="leading-[16.5px]">Avg. days to pay</p>
      </div>
    </div>
  );
}

function Details7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Details">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[47.7px]">
        <p className="leading-[16.5px]">12.4 days</p>
      </div>
    </div>
  );
}

function Container147() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Term7 />
      <Details7 />
    </div>
  );
}

function Descriptions1() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full" data-name="Descriptions">
      <Container144 />
      <Container145 />
      <Container146 />
      <Container147 />
    </div>
  );
}

function Container148() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[63.38px]">
        <p className="leading-[15px]">Monthly target</p>
      </div>
    </div>
  );
}

function Container149() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[36.16px]">
        <p className="leading-[15px]">$35,000</p>
      </div>
    </div>
  );
}

function Container150() {
  return (
    <div className="relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <Container148 />
          <Container149 />
        </div>
      </div>
    </div>
  );
}

function Container151() {
  return (
    <div className="h-[8px] overflow-clip relative rounded-[9999px] shrink-0 w-full" data-name="Container">
      <div className="absolute bg-[#9ae83e] bottom-0 left-0 right-[18%] rounded-[9999px] top-0" data-name="Background" />
    </div>
  );
}

function Container152() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[190.69px]">
        <p className="leading-[15px]">82% of target reached. On pace to hit goal.</p>
      </div>
    </div>
  );
}

function Container153() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-name="Container">
      <Container150 />
      <Container151 />
      <Container152 />
    </div>
  );
}

function Margin12() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[16px] px-0 relative shrink-0 w-full" data-name="Margin">
      <Container153 />
    </div>
  );
}

function Article10() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col items-start justify-between p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[309.34px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <HeaderMargin />
      <Descriptions1 />
      <Margin12 />
    </div>
  );
}

function Section3() {
  return (
    <div className="content-stretch flex gap-[24px] items-start justify-center relative shrink-0 w-full" data-name="Section">
      <Article9 />
      <Article10 />
    </div>
  );
}

function Heading7() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[50.45px]">
        <p className="leading-[20px]">Reports</p>
      </div>
    </div>
  );
}

function Container154() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[163.23px]">
        <p className="leading-[16.5px]">Quick access to common insights</p>
      </div>
    </div>
  );
}

function Container155() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Heading7 />
      <Container154 />
    </div>
  );
}

function Svg31() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container156() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[49.53px]">
        <p className="leading-[16.5px]">All reports</p>
      </div>
    </div>
  );
}

function Button9() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg31 />
      <Container156 />
    </div>
  );
}

function Header8() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Header">
      <Container155 />
      <Button9 />
    </div>
  );
}

function Svg32() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Background21() {
  return (
    <div className="bg-[#3d3d3d] box-border content-stretch flex gap-[4px] items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <Svg32 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[57.25px]">
        <p className="leading-[15px]">Performance</p>
      </div>
    </div>
  );
}

function Margin13() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0" data-name="Margin">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 w-[87.39px]">
        <p className="leading-[18px]">Studio utilization</p>
      </div>
    </div>
  );
}

function Button10() {
  return (
    <div className="absolute bg-[#1b1b1b] box-border content-stretch flex flex-col gap-[4px] items-start left-0 pl-[13px] pr-[88.1px] py-[13px] rounded-[8px] top-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <Background21 />
      <Margin13 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[191.23px]">
        <p className="leading-[15px]">See billable vs. non‑billable hours by week.</p>
      </div>
    </div>
  );
}

function Svg33() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Background22() {
  return (
    <div className="bg-[#3d3d3d] box-border content-stretch flex gap-[4px] items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <Svg33 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[35.58px]">
        <p className="leading-[15px]">Finance</p>
      </div>
    </div>
  );
}

function Margin14() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0" data-name="Margin">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 w-[95.39px]">
        <p className="leading-[18px]">Revenue by client</p>
      </div>
    </div>
  );
}

function Button11() {
  return (
    <div className="absolute bg-[#1b1b1b] box-border content-stretch flex flex-col gap-[4px] items-start left-[308.33px] pl-[13px] pr-[30.28px] py-[13px] rounded-[8px] top-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <Background22 />
      <Margin14 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[249.05px]">
        <p className="leading-[15px]">{`Breakdown of invoiced & collected revenue per account.`}</p>
      </div>
    </div>
  );
}

function Svg34() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Background23() {
  return (
    <div className="bg-[#3d3d3d] box-border content-stretch flex gap-[4px] items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <Svg34 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[41.14px]">
        <p className="leading-[15px]">Accounts</p>
      </div>
    </div>
  );
}

function Margin15() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0" data-name="Margin">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 w-[66.72px]">
        <p className="leading-[18px]">Client health</p>
      </div>
    </div>
  );
}

function Button12() {
  return (
    <div className="absolute bg-[#1b1b1b] box-border content-stretch flex flex-col gap-[4px] items-start left-0 pl-[13px] pr-[46.8px] py-[13px] rounded-[8px] top-[106px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <Background23 />
      <Margin15 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[232.53px]">
        <p className="leading-[15px]">Track engagement, risk, and opportunities per client.</p>
      </div>
    </div>
  );
}

function Svg35() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Background24() {
  return (
    <div className="bg-[#3d3d3d] box-border content-stretch flex gap-[4px] items-center px-[6px] py-[2px] relative rounded-[9999px] shrink-0" data-name="Background">
      <Svg35 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[10px] text-neutral-50 w-[36.13px]">
        <p className="leading-[15px]">Delivery</p>
      </div>
    </div>
  );
}

function Margin16() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-0 pt-[4px] px-0 relative shrink-0" data-name="Margin">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[18px] justify-center leading-[0] not-italic relative shrink-0 text-[12px] text-neutral-50 w-[109.39px]">
        <p className="leading-[18px]">Project status roll‑up</p>
      </div>
    </div>
  );
}

function Button13() {
  return (
    <div className="absolute bg-[#1b1b1b] box-border content-stretch flex flex-col gap-[4px] items-start left-[308.33px] pl-[13px] pr-[30.31px] py-[13px] rounded-[8px] top-[106px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <Background24 />
      <Margin16 />
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[249.02px]">
        <p className="leading-[15px]">Overview of deadlines, risks, and completed milestones.</p>
      </div>
    </div>
  );
}

function Container157() {
  return (
    <div className="h-[196px] relative shrink-0 w-full" data-name="Container">
      <Button10 />
      <Button11 />
      <Button12 />
      <Button13 />
    </div>
  );
}

function Article11() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[642.66px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Header8 />
      <Container157 />
    </div>
  );
}

function Heading8() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Heading 2">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[95.88px]">
        <p className="leading-[20px]">Studio settings</p>
      </div>
    </div>
  );
}

function Container158() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[151.02px]">
        <p className="leading-[16.5px]">Preferences for this workspace</p>
      </div>
    </div>
  );
}

function Header9() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Header">
      <Heading8 />
      <Container158 />
    </div>
  );
}

function Label() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[61.77px]">
        <p className="leading-[16.5px]">Studio name</p>
      </div>
    </div>
  );
}

function Container159() {
  return (
    <div className="content-stretch flex flex-col items-start overflow-clip relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[55.66px]">
        <p className="leading-[16.5px]">sako studio</p>
      </div>
    </div>
  );
}

function Input() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Input">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="box-border content-stretch flex flex-col items-start px-[9px] py-[7px] relative w-full">
          <Container159 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Container160() {
  return (
    <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full" data-name="Container">
      <Label />
      <Input />
    </div>
  );
}

function Label1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[50.95px]">
        <p className="leading-[16.5px]">Time zone</p>
      </div>
    </div>
  );
}

function Container161() {
  return (
    <div className="box-border content-stretch flex flex-col items-start overflow-clip px-0 py-px relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[66.66px]">
        <p className="leading-[12px]">Europe/Berlin</p>
      </div>
    </div>
  );
}

function Options1() {
  return (
    <div className="bg-[#1b1b1b] relative rounded-[8px] shrink-0 w-full" data-name="Options">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="flex flex-col justify-center size-full">
        <div className="box-border content-stretch flex flex-col items-start justify-center pl-[13px] pr-[25px] py-[7px] relative w-full">
          <Container161 />
        </div>
      </div>
    </div>
  );
}

function Container162() {
  return (
    <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full" data-name="Container">
      <Label1 />
      <Options1 />
    </div>
  );
}

function Legend() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-[59.92px]" data-name="Legend">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[59.92px]">
        <p className="leading-[16.5px]">Notifications</p>
      </div>
    </div>
  );
}

function Container163() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[99.64px]">
        <p className="leading-[16.5px]">Client activity emails</p>
      </div>
    </div>
  );
}

function Label2() {
  return (
    <div className="bg-[#9ae83e] h-[16px] relative rounded-[9999px] shrink-0 w-[28px]" data-name="Label">
      <div className="absolute bg-[#1a1a1a] left-[2px] rounded-[9999px] size-[12px] top-[2px]" data-name="Background" />
    </div>
  );
}

function Container164() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container163 />
      <Label2 />
    </div>
  );
}

function Container165() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[11px] w-[84.16px]">
        <p className="leading-[16.5px]">Weekly summary</p>
      </div>
    </div>
  );
}

function Label3() {
  return (
    <div className="bg-[#9ae83e] h-[16px] relative rounded-[9999px] shrink-0 w-[28px]" data-name="Label">
      <div className="absolute bg-[#1a1a1a] left-[2px] rounded-[9999px] size-[12px] top-[2px]" data-name="Background" />
    </div>
  );
}

function Container166() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container165 />
      <Label3 />
    </div>
  );
}

function Fieldset() {
  return (
    <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0 w-full" data-name="Fieldset">
      <Legend />
      <Container164 />
      <Container166 />
    </div>
  );
}

function Container167() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[149.91px]">
        <p className="leading-[15px]">Changes are saved automatically.</p>
      </div>
    </div>
  );
}

function Svg36() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container168() {
  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[17px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-center text-neutral-50 w-[48.94px]">
        <p className="leading-[16.5px]">Advanced</p>
      </div>
    </div>
  );
}

function Button14() {
  return (
    <div className="bg-[#1b1b1b] box-border content-stretch flex gap-[4px] items-center px-[9px] py-[5px] relative rounded-[9999px] shrink-0" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Svg36 />
      <Container168 />
    </div>
  );
}

function Container169() {
  return (
    <div className="box-border content-stretch flex items-center justify-between pb-0 pt-[8px] px-0 relative shrink-0 w-full" data-name="Container">
      <Container167 />
      <Button14 />
    </div>
  );
}

function Form() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full" data-name="Form">
      <Container160 />
      <Container162 />
      <Fieldset />
      <Container169 />
    </div>
  );
}

function Article12() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex flex-col gap-[12px] items-start p-[21px] relative rounded-[12px] self-stretch shrink-0 w-[309.34px]" data-name="Article">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <Header9 />
      <Form />
    </div>
  );
}

function Section4() {
  return (
    <div className="content-stretch flex gap-[24px] items-start justify-center relative shrink-0 w-full" data-name="Section">
      <Article11 />
      <Article12 />
    </div>
  );
}

function Main() {
  return (
    <div className="absolute bottom-[40px] box-border content-stretch flex flex-col gap-[24px] items-start left-0 p-[24px] right-0 top-[61.25px]" data-name="Main">
      <Section />
      <Section1 />
      <Section2 />
      <Section3 />
      <Section4 />
    </div>
  );
}

function Container170() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[173.59px]">
        <p className="leading-[15px]">© 2025 sako studio. All rights reserved.</p>
      </div>
    </div>
  );
}

function Link() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[32.8px]">
        <p className="leading-[15px]">Privacy</p>
      </div>
    </div>
  );
}

function Link1() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Link">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[27.23px]">
        <p className="leading-[15px]">Terms</p>
      </div>
    </div>
  );
}

function Svg37() {
  return <div className="shrink-0 size-[12px]" data-name="SVG" />;
}

function Container171() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[34.47px]">
        <p className="leading-[15px]">Contact</p>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <div className="content-stretch flex gap-[4px] items-center relative shrink-0" data-name="Link">
      <Svg37 />
      <Container171 />
    </div>
  );
}

function Container172() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0" data-name="Container">
      <Link />
      <Link1 />
      <Link2 />
    </div>
  );
}

function Footer2() {
  return (
    <div className="absolute bg-[#1b1b1b] box-border content-stretch flex items-center justify-between left-0 pb-[12px] pt-[13px] px-[24px] right-0 top-[1882.25px]" data-name="Footer">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[1px_0px_0px] border-solid inset-0 pointer-events-none" />
      <Container170 />
      <Container172 />
    </div>
  );
}

function Container173() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[16px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[12px] tracking-[1.92px] uppercase w-[93.3px]">
        <p className="leading-[16px]">Dashboard</p>
      </div>
    </div>
  );
}

function Container174() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[20px] justify-center leading-[0] not-italic relative shrink-0 text-[14px] text-neutral-50 tracking-[-0.35px] w-[102.11px]">
        <p className="leading-[20px]">Studio overview</p>
      </div>
    </div>
  );
}

function Container175() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0" data-name="Container">
      <Container173 />
      <Container174 />
    </div>
  );
}

function Container176() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[33px] overflow-clip right-[25px] top-[8px]" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[14px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[12px] w-[168.73px]">
        <p className="leading-[normal]">Search clients, projects, tasks...</p>
      </div>
    </div>
  );
}

function Container177() {
  return <div className="h-[16px] shrink-0 w-[390px]" data-name="Container" />;
}

function Margin17() {
  return <div className="h-[8px] shrink-0 w-[12px]" data-name="Margin" />;
}

function Container178() {
  return (
    <div className="absolute content-stretch flex items-center left-[33px] right-[13px] top-[7px]" data-name="Container">
      <Container177 />
      <Margin17 />
    </div>
  );
}

function Input1() {
  return (
    <div className="bg-[#1a1a1a] h-[30px] relative rounded-[8px] shrink-0 w-full" data-name="Input">
      <div className="h-[30px] overflow-clip relative rounded-[inherit] w-full">
        <Container176 />
        <Container178 />
      </div>
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Svg38() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function Container179() {
  return (
    <div className="absolute bottom-0 content-stretch flex items-center left-[12px] top-0" data-name="Container">
      <Svg38 />
    </div>
  );
}

function Label4() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="Label">
      <Input1 />
      <Container179 />
    </div>
  );
}

function Container180() {
  return (
    <div className="content-stretch flex flex-col items-start max-w-[448px] relative shrink-0 w-[448px]" data-name="Container">
      <Label4 />
    </div>
  );
}

function Container181() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 w-[815.3px]" data-name="Container">
      <Container175 />
      <Container180 />
    </div>
  );
}

function Svg39() {
  return <div className="shrink-0 size-[16px]" data-name="SVG" />;
}

function ButtonNotifications() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex items-center justify-center p-px relative rounded-[8px] shrink-0 size-[32px] z-[2]" data-name="Button - Notifications">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <Svg39 />
      <div className="absolute bg-[#f4212e] right-[5px] rounded-[9999px] size-[8px] top-[5px]" data-name="Background" />
    </div>
  );
}

function Background25() {
  return (
    <div className="bg-[#9ae83e] content-stretch flex items-center justify-center relative rounded-[9999px] shrink-0 size-[24px]" data-name="Background">
      <div className="flex flex-col font-['Liberation_Sans:Bold',sans-serif] h-[15px] justify-center leading-[0] not-italic relative shrink-0 text-[#1a1a1a] text-[10px] text-center w-[13.91px]">
        <p className="leading-[15px]">SK</p>
      </div>
    </div>
  );
}

function Container182() {
  return (
    <div className="box-border content-stretch flex flex-col items-start mb-[-1px] pb-[0.75px] pt-0 px-0 relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[14px] justify-center leading-[0] not-italic relative shrink-0 text-[11px] text-neutral-50 w-[58.7px]">
        <p className="leading-[13.75px]">Sako Admin</p>
      </div>
    </div>
  );
}

function Container183() {
  return (
    <div className="box-border content-stretch flex flex-col items-start mb-[-1px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-col font-['Liberation_Sans:Regular',sans-serif] h-[13px] justify-center leading-[0] not-italic relative shrink-0 text-[#afafaf] text-[10px] w-[29.45px]">
        <p className="leading-[12.5px]">Owner</p>
      </div>
    </div>
  );
}

function Container184() {
  return (
    <div className="box-border content-stretch flex flex-col items-start pb-px pt-0 px-0 relative shrink-0" data-name="Container">
      <Container182 />
      <Container183 />
    </div>
  );
}

function BackgroundBorder3() {
  return (
    <div className="bg-[#1a1a1a] box-border content-stretch flex gap-[8px] items-center pb-[5px] pt-[4px] px-[9px] relative rounded-[9999px] shrink-0 z-[1]" data-name="Background+Border">
      <div aria-hidden="true" className="absolute border border-[#2d2d2d] border-solid inset-0 pointer-events-none rounded-[9999px]" />
      <Background25 />
      <Container184 />
    </div>
  );
}

function Container185() {
  return (
    <div className="content-stretch flex gap-[8px] isolate items-center relative shrink-0" data-name="Container">
      <ButtonNotifications />
      <BackgroundBorder3 />
    </div>
  );
}

function Header10() {
  return (
    <div className="absolute backdrop-blur-sm backdrop-filter box-border content-stretch flex items-center justify-between left-0 pb-[13px] pt-[12px] px-[24px] right-0 top-0" data-name="Header">
      <div aria-hidden="true" className="absolute border-[#2d2d2d] border-[0px_0px_1px] border-solid inset-0 pointer-events-none" />
      <Container181 />
      <Container185 />
    </div>
  );
}

function Container186() {
  return (
    <div className="relative self-stretch shrink-0 w-[1024px]" data-name="Container">
      <Main />
      <Footer2 />
      <Header10 />
    </div>
  );
}

export default function Body2() {
  return (
    <div className="bg-[#1b1b1b] content-stretch flex items-start relative size-full" data-name="Body">
      <Aside />
      <Container186 />
    </div>
  );
}
