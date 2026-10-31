import Image from "next/image";

export function AuthorCard() {
    return (
        <div className="flex items-center gap-3">
            <Image
                src="/founders/koushik.jpg"
                alt="Your Founder"
                width={40}
                height={40}
                className="rounded-full object-cover ring-2 ring-gray-100"
            />
            <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">
                    Your Founder
                </p>
                <p className="text-xs text-gray-500">Founder</p>
            </div>
        </div>
    );
}
