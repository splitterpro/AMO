export interface SuggestedQuestion {
  id: number
  label: string
  question: string
  description: string
}

export const QUESTIONS: SuggestedQuestion[] = [
  {
    id: 1,
    label: 'Losing products',
    question: 'Which product lines sell well but lose money?',
    description: 'Find products that are generating losses or low profit.',
  },
  {
    id: 2,
    label: 'Discounts',
    question: 'At what discount level do sales start losing money?',
    description: 'Understand the impact of discounts on sales and profit.',
  },
  {
    id: 3,
    label: 'Weak regions',
    question: 'Which regions and states are hurting our profit the most?',
    description: 'Identify underperforming regions or low sales areas.',
  },
  {
    id: 4,
    label: 'Profit stars',
    question: 'Which products and sub-categories make the most profit?',
    description: 'Top categories, products or segments by profit.',
  },
  {
    id: 5,
    label: 'Key customers',
    question: 'How much do we depend on a few customers, and are they profitable?',
    description: 'Discover your most valuable customers by sales or profit.',
  },
  {
    id: 6,
    label: 'Growth and peaks',
    question: 'How have sales and profit grown, and which months are busiest?',
    description: 'Analyze trends, growth patterns and seasonal peaks.',
  },
]
