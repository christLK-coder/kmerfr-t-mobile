// Source unique de vérité pour toutes les couleurs KmerFret
// NE PAS importer de couleurs depuis un autre fichier — uniquement depuis ici

export const Brand = {
  green900: '#1B5E20',
  green800: '#2E7D32',
  green700: '#388E3C',
  green600: '#43A047',
  green500: '#4CAF50',
  green200: '#A5D6A7',
  green100: '#C8E6C9',
  green50:  '#E8F5E9',

  orange800: '#BF360C',
  orange700: '#E65100',
  orange600: '#F4511E',
  orange500: '#FF6D00',
  orange100: '#FFE0B2',
  orange50:  '#FFF3E0',

  grey900: '#212121',
  grey800: '#424242',
  grey700: '#616161',
  grey600: '#757575',
  grey400: '#BDBDBD',
  grey300: '#E0E0E0',
  grey200: '#EEEEEE',
  grey100: '#F5F5F5',
  grey50:  '#FAFAFA',
  white:   '#FFFFFF',
  black:   '#000000',

  red900:  '#B71C1C',
  red700:  '#C62828',
  red200:  '#EF9A9A',
  red50:   '#FFEBEE',

  amber700: '#F57F17',
  amber200: '#FFE082',
  amber50:  '#FFFDE7',

  blue800: '#0277BD',
  blue200: '#90CAF9',
  blue50:  '#E3F2FD',
};

export const Light = {
  primary:            Brand.green900,
  primaryVariant:     Brand.green800,
  primaryContainer:   Brand.green100,
  onPrimary:          Brand.white,
  onPrimaryContainer: Brand.green900,

  secondary:          Brand.orange700,
  secondaryContainer: Brand.orange100,
  onSecondary:        Brand.white,
  onSecondaryContainer: Brand.orange800,

  background:         Brand.grey100,
  surface:            Brand.white,
  surfaceVariant:     Brand.grey50,
  surfaceElevated:    Brand.white,
  onSurface:          Brand.grey900,
  onSurfaceVariant:   Brand.grey700,

  outline:            Brand.grey300,
  outlineVariant:     Brand.grey200,

  error:              Brand.red700,
  onError:            Brand.white,
  errorContainer:     Brand.red50,

  success:            Brand.green800,
  successContainer:   Brand.green50,

  warning:            Brand.amber700,
  warningContainer:   Brand.amber50,

  info:               '#00897B',
  infoContainer:      '#E0F2F1',

  textPrimary:        Brand.grey900,
  textSecondary:      Brand.grey700,
  textMuted:          Brand.grey400,
  textInverted:       Brand.white,

  divider:            Brand.grey200,
  shadow:             'rgba(0,0,0,0.08)',
  shadowMedium:       'rgba(0,0,0,0.15)',

  // Statuts missions — palette vert/orange cohérente
  statusOpen:         '#00897B', // teal vert — distinguishable de DELIVERED
  statusAssigned:     Brand.amber700,
  statusInTransit:    Brand.orange700,
  statusDelivered:    Brand.green800,
  statusCancelled:    Brand.grey600,
  statusDisputed:     Brand.red700,

  // Gradients
  gradientPrimaryStart: Brand.green900,
  gradientPrimaryEnd:   Brand.green700,
  gradientDriverStart:  Brand.green800,
  gradientDriverEnd:    Brand.green600,
};

export const Dark = {
  primary:            '#81C784',
  primaryVariant:     Brand.green200,
  primaryContainer:   '#1A3D1A',
  onPrimary:          '#003300',
  onPrimaryContainer: Brand.green200,

  secondary:          '#FFAB40',
  secondaryContainer: '#3D1A00',
  onSecondary:        '#1A0A00',
  onSecondaryContainer: Brand.orange100,

  background:         '#0F0F0F',
  surface:            '#1A1A1A',
  surfaceVariant:     '#242424',
  surfaceElevated:    '#2C2C2C',
  onSurface:          '#E8E8E8',
  onSurfaceVariant:   '#AAAAAA',

  outline:            '#3A3A3A',
  outlineVariant:     '#2A2A2A',

  error:              Brand.red200,
  onError:            '#3D0000',
  errorContainer:     '#3D0000',

  success:            '#81C784',
  successContainer:   '#1A3D1A',

  warning:            Brand.amber200,
  warningContainer:   '#3D2800',

  info:               '#80CBC4',
  infoContainer:      '#004D40',

  textPrimary:        '#E8E8E8',
  textSecondary:      '#AAAAAA',
  textMuted:          '#666666',
  textInverted:       Brand.grey900,

  divider:            '#2A2A2A',
  shadow:             'rgba(0,0,0,0.40)',
  shadowMedium:       'rgba(0,0,0,0.60)',

  statusOpen:         '#80CBC4', // teal clair
  statusAssigned:     Brand.amber200,
  statusInTransit:    '#FFAB40',
  statusDelivered:    '#81C784',
  statusCancelled:    '#888888',
  statusDisputed:     Brand.red200,

  gradientPrimaryStart: '#1A3D1A',
  gradientPrimaryEnd:   '#243D24',
  gradientDriverStart:  '#1A3D1A',
  gradientDriverEnd:    '#243D24',
};

export type ColorScheme = typeof Light;
