import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";
import ListIcon from "./components/ListIcon";

export default {
  register(app: any) {
    app.customFields.register({
      name: "list-field",
      pluginId: PLUGIN_ID,
      type: "json",
      icon: ListIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.list-field.label`,
        defaultMessage: "List Field"
      },
      intlDescription: {
        id: `${PLUGIN_ID}.list-field.description`,
        defaultMessage: "A custom field to manage lists"
      },
      components: {
        Input: async () => import("./components/ListInput")
      },
      options: {
        base: [
          {
            sectionTitle: {
              id: "global.settings",
              defaultMessage: "Settings"
            },
            items: [
              {
                name: "options.placeholder",
                type: "text",
                intlLabel: {
                  id: `${PLUGIN_ID}.list-field.options.placeholder.label`,
                  defaultMessage: "Placeholder"
                },
                description: {
                  id: `${PLUGIN_ID}.list-field.options.placeholder.description`,
                  defaultMessage: "Placeholder text for the list input"
                }
              }
            ]
          }
        ],
        advanced: [
          {
            sectionTitle: {
              id: "global.settings",
              defaultMessage: "Settings"
            },
            items: [
              {
                name: "required",
                type: "checkbox",
                intlLabel: {
                  id: `${PLUGIN_ID}.list-field.options.required.label`,
                  defaultMessage: "Required field"
                },
                description: {
                  id: `${PLUGIN_ID}.list-field.options.required.description`,
                  defaultMessage:
                    "You won't be able to create an entry if this field is empty"
                }
              }
            ]
          }
        ],
        validator: () => ({})
      }
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(
            `./translations/${locale}.json`
          );

          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  }
};
