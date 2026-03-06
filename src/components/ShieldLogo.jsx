const ShieldLogo = ({ size = 120, grayscale = false }) => (
    <img
        src="/images/png-transparent-logo.png"
        alt="Cyrano App"
        width={size}
        height={size}
        style={{
            width: size,
            height: size,
            objectFit: "contain",
            filter: grayscale ? "grayscale(1) opacity(0.22)" : "none",
            transition: "filter 0.3s",
            flexShrink: 0,
        }}
    />
);

export default ShieldLogo;
