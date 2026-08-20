import {FC, memo, useCallback, useMemo,useRef, useState} from 'react';
import {MdExpandLess} from 'react-icons/md';

import type {TimelineItem} from '../../../data/dataDef';

const TimelineItem: FC<{item: TimelineItem}> = memo(({item}) => {
  const {title, date, location, content} = item;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prevIsOpen) => !prevIsOpen)
  }, []);

  const toggleIconStyle = useMemo(() => ({
    transform: isOpen ? 'rotate(0)' : 'rotate(-180deg)',
  }), [isOpen]);
  return (
    <div className="pb-8 text-center last:pb-0 md:text-left">
      <div className="flex flex-col pb-4">
        <h2 className="text-xl font-bold">{location}</h2>
        <div className="flex items-center justify-center gap-x-2 md:justify-start">
          <span className="flex-1 text-sm font-medium italic sm:flex-none">{title}</span>
          <span>•</span>
          <span className="flex-1 text-sm sm:flex-none">{date}</span>
        </div>
      </div>
      <div className="flex flex-row justify-center sm:justify-start">
      <MdExpandLess
        className="h-[25px] w-[25px] rounded-xl bg-white hover:bg-gray-300 border border-black transition-all duration-300 cursor-pointer"
        color="black"
        onClick={handleToggle}
        style={toggleIconStyle}
      />
      </div>
      
      
      <div
        className="overflow-hidden mt-2 transition-all duration-300"
        id="container"
        ref={containerRef}
        style={{
          height: isOpen ? '100%' : '0px',
        }}>
        <div className="" id="text" ref={textRef}>
          {content}
        </div>
      </div>
    </div>
  );
});

TimelineItem.displayName = 'TimelineItem';
export default TimelineItem;
