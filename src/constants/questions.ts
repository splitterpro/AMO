export interface SuggestedQuestion {
  id: number
  label: string
  question: string
}

export const QUESTIONS: SuggestedQuestion[] = [
  { id: 1, label: "Losing products",  question: "Which product lines sell well but lose money?" },
  { id: 2, label: "Discounts",        question: "At what discount level do sales start losing money?" },
  { id: 3, label: "Weak regions",     question: "Which regions and states are hurting our profit the most?" },
  { id: 4, label: "Profit stars",     question: "Which products and sub-categories make the most profit?" },
  { id: 5, label: "Key customers",    question: "How much do we depend on a few customers, and are they profitable?" },
  { id: 6, label: "Growth and peaks", question: "How have sales and profit grown, and which months are busiest?" },
]
