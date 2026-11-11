import {FC, memo, useId, useState} from 'react';
import {MdExpandLess} from 'react-icons/md';

import type {TimelineItem as TimelineItemData} from '../../../data/dataDef';

const TimelineItem: FC<{item: TimelineItemData; alwaysVisible?: boolean}> = memo(({item, alwaysVisible = false}) => {
  const {title, date, location, content} = item;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const contentId = useId();

  if (alwaysVisible) {
    return (
      <article className="relative border-l border-neutral-300 pb-10 pl-5 text-left last:pb-0 sm:pl-8">
        <span aria-hidden="true" className="absolute -left-1 top-2 h-2 w-2 rounded-full bg-fuchsia-700" />
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <h3 className="text-xl font-bold leading-snug text-neutral-900">{title}</h3>
            <p className="mt-1 font-medium text-fuchsia-800">{location}</p>
          </div>
          <p className="shrink-0 text-sm leading-6 text-neutral-600">{date}</p>
        </div>
        <div className="max-w-prose text-base leading-7 text-neutral-700 [&_li+li]:mt-3 [&_li]:pl-1 [&_li]:marker:text-fuchsia-700">
          {content}
        </div>
      </article>
    );
  }
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
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Hide' : 'Show'} ${title} details`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-neutral-400 bg-white text-neutral-900 hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-700"
        onClick={() => setIsOpen(open => !open)}
        type="button">
        <MdExpandLess
          aria-hidden="true"
          className="h-6 w-6"
          style={{transform: isOpen ? 'rotate(0)' : 'rotate(-180deg)'}}
        />
      </button>
      <div className="mt-2" hidden={!isOpen} id={contentId}>
        {content}
      </div>
    </div>
  );
});

TimelineItem.displayName = 'TimelineItem';
export default TimelineItem;
