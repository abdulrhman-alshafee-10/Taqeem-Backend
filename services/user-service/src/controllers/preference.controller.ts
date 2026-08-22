import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { publishEvent } from '../events/publisher.js';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

let features: any[] = [];
let dietary: any[] = [];

try {
  const cataloguesDir = path.join(process.cwd(), '..', '..', 'shared', 'catalogues');
  features = JSON.parse(fs.readFileSync(path.join(cataloguesDir, 'features.json'), 'utf8'));
  dietary = JSON.parse(fs.readFileSync(path.join(cataloguesDir, 'dietary.json'), 'utf8'));
} catch (e) {
  console.error('Could not load catalogues', e);
}

export async function getPreferences(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    let prefs = await prisma.userPreference.findUnique({ where: { userId } });
    if (!prefs) {
      prefs = await prisma.userPreference.create({ data: { userId } });
    }
    res.json(prefs);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

export async function updatePreferences(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const data = req.body;

    // Basic validation against catalogues
    if (data.featurePrefs) {
      const validFeatures = features.map(f => f.id);
      if (!data.featurePrefs.every((f: string) => validFeatures.includes(f))) {
        return res.status(400).json({ error: 'Invalid feature preferences' });
      }
    }
    if (data.dietary) {
      const validDietary = dietary.map(d => d.id);
      if (!data.dietary.every((d: string) => validDietary.includes(d))) {
        return res.status(400).json({ error: 'Invalid dietary preferences' });
      }
    }

    if (data.cuisinePrefsFreeText && data.cuisinePrefsFreeText.length > 240) {
      return res.status(400).json({ error: 'cuisinePrefsFreeText exceeds 240 characters' });
    }

    const prefs = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        favoriteCategories: data.favoriteCategories,
        dislikedCategories: data.dislikedCategories,
        dietary: data.dietary,
        atmospherePrefs: data.atmospherePrefs,
        featurePrefs: data.featurePrefs,
        priceTierPrefs: data.priceTierPrefs,
        citiesOfInterest: data.citiesOfInterest,
        cuisinePrefsFreeText: data.cuisinePrefsFreeText,
        accessibilityNeeds: data.accessibilityNeeds,
      },
      create: {
        userId,
        favoriteCategories: data.favoriteCategories || [],
        dislikedCategories: data.dislikedCategories || [],
        dietary: data.dietary || [],
        atmospherePrefs: data.atmospherePrefs || [],
        featurePrefs: data.featurePrefs || [],
        priceTierPrefs: data.priceTierPrefs || [],
        citiesOfInterest: data.citiesOfInterest || [],
        cuisinePrefsFreeText: data.cuisinePrefsFreeText,
        accessibilityNeeds: data.accessibilityNeeds || [],
      }
    });

    await publishEvent('user.preferences_updated', {
      userId,
      preferences: prefs
    });

    res.json(prefs);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
