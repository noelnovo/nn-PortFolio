import * as React from 'react';

interface SVGRProps {
  title?: string;
  titleId?: string;
}

const CustomCarIcon = React.memo(
  React.forwardRef<SVGSVGElement, SVGRProps>(({title, titleId, ...props}: SVGRProps, ref) => {
    return (
      <svg aria-labelledby={titleId} fill="currentColor" height="1em" ref={ref} viewBox="0 0 24 24" width="1em" {...props}>
        {title && <title id={titleId}>{title}</title>}
        <path d="M20.772 10.156l-1.368-4.105A2.995 2.995 0 0016.559 4H7.441a2.995 2.995 0 00-2.845 2.051l-1.368 4.105A2.003 2.003 0 002 12v5c0 .753.423 1.402 1.039 1.743-.013.066-.039.126-.039.195V21a1 1 0 001 1h1a1 1 0 001-1v-2h12v2a1 1 0 001 1h1a1 1 0 001-1v-2.062c0-.069-.026-.13-.039-.195A1.993 1.993 0 0022 17v-5c0-.829-.508-1.541-1.228-1.844zM4 17v-5h16l.002 5H4zM7.441 6h9.117c.431 0 .813.274.949.684L18.613 10H5.387l1.105-3.316A1 1 0 017.441 6z" />
        <path d="M8 14.5 A1.5 1.5 0 0 1 6.5 16 A1.5 1.5 0 0 1 5 14.5 A1.5 1.5 0 0 1 8 14.5 z" />
        <path d="M19 14.5 A1.5 1.5 0 0 1 17.5 16 A1.5 1.5 0 0 1 16 14.5 A1.5 1.5 0 0 1 19 14.5 z" />
      </svg>
    );
  }),
);

CustomCarIcon.displayName = 'CustomCarIcon'; // Helpful for debugging

export default CustomCarIcon;
