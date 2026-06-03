import type { ActivityType } from './types.js';

export const ALL_TYPES: ActivityType[] = [
  'AIRBNB', 'TURO', 'PROPERTY', 'PERSONAL', 'HOUSE_FLIP', 'BUSINESS', 'CUSTOM'
];

export const TYPE_LABELS: Record<ActivityType, string> = {
  AIRBNB:     'AirBnB',
  TURO:       'Turo',
  PROPERTY:   'Property',
  PERSONAL:   'Personal',
  HOUSE_FLIP: 'House Flip',
  BUSINESS:   'Business',
  CUSTOM:     'Other'
};

export const TYPE_DESCRIPTIONS: Record<ActivityType, string> = {
  AIRBNB:     'Short-term rental on AirBnB',
  TURO:       'Vehicle rented out on Turo',
  PROPERTY:   'Owned property (personal use or tenant)',
  PERSONAL:   'Personal expenses, bills, and income',
  HOUSE_FLIP: 'Property being renovated for resale',
  BUSINESS:   'Side hustle or business venture',
  CUSTOM:     'Anything else'
};
