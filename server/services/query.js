'use strict';

const { noLimit, getService } = require("../utils");

/**
 * Query service.
 */

/**
 * Get an array of fields extracted from all the patterns across
 * the different languages.
 *
 * @param {obj} contentType - The content type
 * @param {bool} topLevel - Should include only top level fields
 * @param {bool} isLocalized - Should include the locale field
 * @param {string} relation - Specify a relation. If you do; the function will only return fields of that relation.
 *
 * @returns {array} The fields.
 */
const getFieldsFromConfig = (contentType, topLevel = false, isLocalized = false, relation) => {
  let fields = [];

  if (contentType) {
    Object.entries(contentType['languages']).map(([langcode, { pattern }]) => {
      fields.push(...getService('pattern').getFieldsFromPattern(pattern, topLevel, relation));
    });
  }

  if (topLevel) {
    if (isLocalized) {
      fields.push('locale');
    }

    fields.push('updatedAt');
  }

  // Remove duplicates
  fields = [...new Set(fields)];

  return fields;
};

/**
 * Get an object of relations extracted from all the patterns across
 * the different languages.
 *
 * @param {obj} contentType - The content type
 *
 * @returns {object} The relations.
 */
const getRelationsFromConfig = (contentType) => {
  const relationsObject = {};

  if (contentType) {
    Object.entries(contentType['languages']).map(([langcode, { pattern }]) => {
      const relations = getService('pattern').getRelationsFromPattern(pattern);
      relations.map((relation) => {
        relationsObject[relation] = {
          fields: getFieldsFromConfig(contentType, false, false, relation),
        };
      });
    });
  }

  return relationsObject;
};

/**
 * Query the nessecary pages from Strapi to build the sitemap with.
 *
 * @param {obj} config - The config object
 * @param {obj} contentType - The content type
 * @param {number} id - A page id
 *
 * @returns {object} The pages.
 */
const getPages = async (config, contentType, id) => {
  const excludeDrafts = config.excludeDrafts && strapi.contentTypes[contentType].options.draftAndPublish;
  const isLocalized = strapi.contentTypes[contentType].pluginOptions?.i18n?.localized;

  const relations = getRelationsFromConfig(config.contentTypes[contentType]);
  const fields = getFieldsFromConfig(config.contentTypes[contentType], true, isLocalized);

  // TODO:
  // Double check if the filters are working correctly
  const filters = {
    $or: [
      {
        sitemap_exclude: {
          $null: true,
        },
      },
      {
        sitemap_exclude: {
          $eq: false,
        },
      },
    ],
    id: id ? {
      $eq: id,
    } : {},
    published_at: excludeDrafts ? {
      $notNull: true,
    } : {},
  };

  const pages = await noLimit(strapi, contentType, {
    where: filters,
    filters,
    locale: 'all',
    fields,
    populate: {
      localizations: {
        fields,
        populate: relations,
      },
      ...relations,
    },
    orderBy: 'id',
  });

  return pages;
};

/**
 * Create a sitemap in the database
 *
 * @param {string} sitemapString - The sitemapString
 * @param {string} name - The name of the sitemap
 * @param {number} delta - The delta of the sitemap
 *
 * @returns {void}
 */
const createSitemap = async (sitemapString, name, delta) => {
  const sitemap = await strapi.entityService.findMany('plugin::sitemap.sitemap', {
    filters: {
      name,
      delta,
    },
    fields: ['id'],
  });

  if (sitemap[0]) {
    await strapi.entityService.delete('plugin::sitemap.sitemap', sitemap[0].id);
  }

  await strapi.entityService.create('plugin::sitemap.sitemap', {
    data: {
      sitemap_string: sitemapString,
      name,
      delta,
    },
  });
};

/**
 * Get a sitemap from the database
 *
 * @param {string} name - The name of the sitemap
 * @param {number} delta - The delta of the sitemap
 *
 * @returns {void}
 */
const getSitemap = async (name, delta) => {
  const sitemap = await strapi.entityService.findMany('plugin::sitemap.sitemap', {
    filters: {
      name,
      delta,
    },
  });

  return sitemap[0];
};

/**
 * Delete a sitemap from the database
 *
 * @param {string} name - The name of the sitemap
 *
 * @returns {void}
 */
const deleteSitemap = async (name) => {
  const sitemaps = await strapi.entityService.findMany('plugin::sitemap.sitemap', {
    filters: {
      name,
    },
    fields: ['id'],
  });

  await Promise.all(sitemaps.map(async (sm) => {
    await strapi.entityService.delete('plugin::sitemap.sitemap', sm.id);
  }));
};

/**
 * Create a sitemap_cache in the database
 *
 * @param {string} sitemapJson - The sitemap JSON
 * @param {string} name - The name of the sitemap
 *
 * @returns {void}
 */
const createSitemapCache = async (sitemapJson, name) => {
  const sitemap = await strapi.entityService.findMany('plugin::sitemap.sitemap-cache', {
    filters: {
      name,
    },
    fields: ['id'],
  });

  if (sitemap[0]) {
    await strapi.entityService.delete('plugin::sitemap.sitemap-cache', sitemap[0].id);
  }

  await strapi.entityService.create('plugin::sitemap.sitemap-cache', {
    data: {
      sitemap_json: sitemapJson,
      name,
    },
  });
};

/**
 * Update a sitemap_cache in the database
 *
 * @param {string} sitemapJson - The sitemap JSON
 * @param {string} name - The name of the sitemap
 *
 * @returns {void}
 */
const updateSitemapCache = async (sitemapJson, name) => {
  const sitemap = await strapi.entityService.findMany('plugin::sitemap.sitemap-cache', {
    filters: {
      name,
    },
    fields: ['id'],
  });

  if (sitemap[0]) {
    await strapi.entityService.update('plugin::sitemap.sitemap-cache', sitemap[0].id, {
      data: {
        sitemap_json: sitemapJson,
        name,
      },
    });
  }
};

/**
 * Get a sitemap_cache from the database
 *
 * @param {string} name - The name of the sitemap
 *
 * @returns {void}
 */
const getSitemapCache = async (name) => {
  const sitemap = await strapi.entityService.findMany('plugin::sitemap.sitemap-cache', {
    filters: {
      name,
    },
  });

  return sitemap[0];
};

module.exports = () => ({
  getPages,
  createSitemap,
  getSitemap,
  deleteSitemap,
  createSitemapCache,
  updateSitemapCache,
  getSitemapCache,
});
