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
    ],
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
  } else {
    body.sort = ["_score"];
  }

  return body;
}
