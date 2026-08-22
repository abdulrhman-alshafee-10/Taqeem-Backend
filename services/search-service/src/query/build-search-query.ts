export function buildSearchQuery(params: any) {
  const {
    q, lat, lng, radiusKm = 10,
    categories = [], priceTier = [],
    minRating, city,
    halalTier = [], hasFamilySection, femaleFriendly = [],
    lang = "ar",
    sort = "relevance",
    page = 1, size = 20,
  } = params;

  const filter: any[] = [
    { term: { isActive: true } },
  ];

  if (categories.length) filter.push({ terms: { categories } });
  if (priceTier.length)  filter.push({ terms: { priceTier } });
  if (halalTier.length)  filter.push({ terms: { halalTier } });
  if (femaleFriendly.length) filter.push({ terms: { femaleFriendly } });
  if (hasFamilySection === "true" || hasFamilySection === true) {
    filter.push({ term: { hasFamilySection: true } });
  }
  if (city)              filter.push({ term:  { city } });
  if (typeof minRating === "number") filter.push({ range: { avgRating: { gte: minRating } } });

  if (params.preferences?.dietary?.includes("halal")) filter.push({ term: { dietary: "halal" } });
  if (params.preferences?.dietary?.includes("vegan")) filter.push({ term: { dietary: "vegan" } });

  if (params.features?.length) {
    filter.push({
      terms_set: {
        features: {
          terms: params.features,
          minimum_should_match_script: { source: `${params.features.length}` }
        }
      }
    });
  }
  if (params.dietary?.length) filter.push({ terms: { dietary: params.dietary } });
  if (params.atmosphere?.length) filter.push({ terms: { atmosphere: params.atmosphere } });

  for (const key of ["food","service","ambience","value","cleanliness"]) {
    const min = params[`minAspect_${key}`];
    if (typeof min === "number") {
      filter.push({ range: { [`aspects.${key}`]: { gte: min } } });
    }
  }

  if (params.accessibility?.length) {
    for (const f of params.accessibility) {
      const [path, value] = f.split(":");
      if (path && value) {
        filter.push({ term: { [`accessibility.${path}`]: value } });
      }
    }
  }

  if (typeof lat === "number" && typeof lng === "number") {
    filter.push({
      geo_distance: {
        distance: `${Math.min(radiusKm, 50)}km`,
        location: { lat, lon: lng },
      },
    });
  }

  const should: any[] = [];
  const must: any[]   = [];

  if (q && q.trim()) {
    const boost = lang.startsWith("ar")
      ? { nameAr: 6, nameEn: 4, descriptionAr: 2, descriptionEn: 1 }
      : { nameEn: 6, nameAr: 4, descriptionEn: 2, descriptionAr: 1 };
      
    must.push({
      multi_match: {
        query: q,
        type:  "best_fields",
        fields: [
          ...Object.entries(boost).map(([f, b]) => `${f}^${b}`),
          "categories^3",
          "city",
        ],
        fuzziness: "AUTO",
        prefix_length: 1,
      },
    });

    // Nested recent-reviews boost
    should.push({
      nested: {
        path: "recentReviews",
        score_mode: "avg",
        query: {
          match: { "recentReviews.body": { query: q, fuzziness: "AUTO" } },
        },
      },
    });
  } else {
    must.push({ match_all: {} });
  }

  // Popularity boost: rating × log(reviewCount)
  const functionScore = {
    function_score: {
      query: { bool: { must, should, filter } },
      functions: [
        { field_value_factor: { field: "avgRating",   factor: 1.2, missing: 0, modifier: "sqrt" } },
        { field_value_factor: { field: "reviewCount", factor: 0.05, missing: 0, modifier: "log1p" } },
        // Preference boosts
        ...(params.preferences?.favoriteCategories?.length ? [
          { filter: { terms: { categories: params.preferences.favoriteCategories } }, weight: 1.3 }
        ] : []),
        ...(params.preferences?.dislikedCategories?.length ? [
          { filter: { terms: { categories: params.preferences.dislikedCategories } }, weight: 0.5 }
        ] : []),
        ...(params.preferences?.featurePrefs?.length ? [
          { filter: { terms: { features: params.preferences.featurePrefs } }, weight: 1.3 }
        ] : [])
      ],
      score_mode: "sum",
      boost_mode: "sum",
    },
  };

  const body: any = {
    from: (page - 1) * size,
    size,
    query: functionScore,
    _source: [
      "id","nameEn","nameAr","slug","descriptionEn","descriptionAr","categories","priceTier",
      "city","region","country","location","avgRating","reviewCount","photos",
      "aspects","features","dietary","atmosphere","paymentMethods",
      "halalTier","servesAlcohol","servesPork","closesDuringPrayers","prayerCloseMinutes",
      "hasFamilySection","hasFamilyOnlyHours","femaleFriendly"
    ],
    aggs: {
      features:   { terms: { field: "features",   size: 30 } },
      dietary:    { terms: { field: "dietary",    size: 15 } },
      atmosphere: { terms: { field: "atmosphere", size: 10 } },
      priceTier:  { terms: { field: "priceTier",  size: 4  } },
      city:       { terms: { field: "city",       size: 20 } },
      halalTier:  { terms: { field: "halalTier",  size: 4  } },
      femaleFriendly: { terms: { field: "femaleFriendly", size: 4 } }
    }
  };

  if (typeof lat === "number" && typeof lng === "number") {
    body.script_fields = {
      distanceKm: {
        script: {
          source: "doc['location'].size()==0 ? null : doc['location'].arcDistance(params.lat, params.lon) / 1000.0",
          params: { lat, lon: lng },
        },
      },
    };
  }

  if (sort === "rating") {
    body.sort = [{ avgRating: "desc" }, "_score"];
  } else if (sort === "distance" && typeof lat === "number") {
    body.sort = [{ _geo_distance: { location: { lat, lon: lng }, order: "asc", unit: "km" } }];
  } else if (sort?.startsWith("aspect.")) {
    const key = sort.split(".")[1];
    body.sort = [{ [`aspects.${key}`]: "desc" }, "_score"];
  } else {
    body.sort = ["_score"];
  }

  return body;
}
