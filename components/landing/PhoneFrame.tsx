interface PhoneFrameProps {
  src: string;
  alt: string;
  className?: string;
}

export default function PhoneFrame({ src, alt, className }: PhoneFrameProps) {
  return (
    <div className={`device ${className ?? ""}`}>
      <div className="screen">
        <div className="notch" />
        <div className="statusbar">
          <span>9:41</span>
          <span>5G</span>
        </div>
        <img src={src} alt={alt} />
      </div>
    </div>
  );
}
