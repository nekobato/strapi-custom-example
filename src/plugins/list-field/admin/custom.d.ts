declare module '@strapi/design-system/*';
declare module '@strapi/design-system';
declare module '@strapi/icons/*';
declare module '@strapi/icons';

// styled-componentsのDefaultThemeを拡張
import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: any;
  }
}
