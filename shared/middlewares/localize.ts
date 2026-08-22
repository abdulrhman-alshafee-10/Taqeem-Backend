import { Request, Response, NextFunction } from "express";

export function localizeMiddleware(req: Request, res: Response, next: NextFunction) {
  const acceptLang = req.headers["accept-language"];
  const userLocale = (req as any).user?.locale;
  
  (req as any).lang = (acceptLang || userLocale || "ar-EG").split(",")[0];
  next();
}

export function localizeEntity(entity: any, lang: string) {
  const wanted = lang.startsWith("ar") ? "Ar" : "En";
  const fallback = wanted === "Ar" ? "En" : "Ar";
  return {
    ...entity,
    name:        entity[`name${wanted}`]        || entity[`name${fallback}`],
    description: entity[`description${wanted}`] || entity[`description${fallback}`],
  };
}
