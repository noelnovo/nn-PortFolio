import {ArrowTopRightOnSquareIcon} from '@heroicons/react/24/outline';
import {FC, memo} from 'react';

import {portfolioItems, SectionId} from '../../data/data';
import {PortfolioItem} from '../../data/dataDef';
import Section from '../Layout/Section';

const Portfolio: FC = memo(() => {
  return (
    <Section className="bg-black" sectionId={SectionId.Portfolio}>
      <div className="flex flex-col gap-y-8">
        <h2 className="self-center text-xl font-bold text-white">Some of my work</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {portfolioItems.map((item, index) => (
            <ItemCard item={item} key={`${item.title}-${index}`} />
          ))}
        </div>
      </div>
    </Section>
  );
});

Portfolio.displayName = 'Portfolio';
export default Portfolio;

const ItemCard: FC<{item: PortfolioItem}> = memo(({item: {url, title, description, Icon}}) => {
  return (
    <a
      className="group flex h-full flex-col gap-y-4 rounded-xl border border-white/10 bg-gray-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500/50 hover:bg-gray-800 hover:shadow-lg hover:shadow-fuchsia-900/30"
      href={url}
      rel="noopener noreferrer"
      target="_blank">
      <Icon className="h-12 w-12 text-white transition-colors duration-300 group-hover:text-fuchsia-400" color="white" />
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-stone-300">{description}</p>
      </div>
      <ArrowTopRightOnSquareIcon className="mt-auto h-5 w-5 shrink-0 self-end text-white transition-colors duration-300 group-hover:text-fuchsia-400" />
    </a>
  );
});

ItemCard.displayName = 'ItemCard';