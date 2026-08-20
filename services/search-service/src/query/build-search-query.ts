export function buildSearchQuery(params: any) {
  const {
    q, lat, lng, radiusKm = 10,
    categories = [], priceTier = [],
    minRating, city,
    sort = "relevance",
    page = 1, size = 20,
  } = params;

  const filter: any[] = [
    { term: { isActive: true } },
  ];

  if (categories.length) filter.push({ terms: { categories } });
  if (priceTier.length)  filter.push({ terms: { priceTier } });
  if (city)              filter.push({ term:  { city } });
  if (typeof minRating === "number") filter.push({ range: { avgRating: { gte: minRating } } });

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
    must.push({
      multi_match: {
        query: q,
        type:  "best_fields",
        fields: [
          "name^5",
          "name.autocomplete^3",
          "description^2",
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
      "id","name","slug","description","categories","priceTier",
      "city","region","country","location","avgRating","reviewCount","photos",
      "aspects","features","dietary","atmosphere","paymentMethods"
    ],
    aggs: {
      features:   { terms: { field: "features",   size: 30 } },
      dietary:    { terms: { field: "dietary",    size: 15 } },
      atmosphere: { terms: { field: "atmosphere", size: 10 } },
      priceTier:  { terms: { field: "priceTier",  size: 4  } },
      city:       { terms: { field: "city",       size: 20 } }
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
