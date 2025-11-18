function parseBossEmbed(embed) {
  if (!embed || !embed.title) return null;

  // Only consider embeds with the monster emoji (boss)
  const monsterEmojiMatch = embed.title.match(/<:LU_Monster:\d+>/);
  if (!monsterEmojiMatch) return null;

  // Extract boss name after emoji
  const bossNameMatch = embed.title.match(/<:LU_Monster:\d+>\s*(.+)/);
  const bossName = bossNameMatch ? bossNameMatch[1].trim() : null;

  // Extract Tier from any embed field containing <:LU_TierX:...>
  let tier = null;
  if (embed.fields && embed.fields.length > 0) {
    for (const field of embed.fields) {
      const tierMatch = field.value.match(/<:LU_Tier(\d+):\d+>/);
      if (tierMatch) {
        tier = `Tier ${tierMatch[1]}`;
        break;
      }
    }
  }

  return (bossName && tier) ? { bossName, tier } : null;
}

function parseCardEmbed(embed) {
  if (!embed) return null;

  const description = embed.description || '';
  // Map rarity codes from emoji in description
  const rarityMap = {
    C: 'Common',
    UC: 'Uncommon',
    R: 'Rare',
    E: 'Exotic',
    L: 'Legendary'
  };

  // Extract rarity code e.g. <:LU_UC:...>
  const rarityMatch = description.match(/:LU_([A-Z]{1,2}):/);
  let rarity = null;
  if (rarityMatch) {
    const code = rarityMatch[1];
    rarity = rarityMap[code] || 'Unknown';
  }

  // Extract card name inside ** ** (first bolded name)
  const nameMatch = description.match(/\*\*(.+?)\*\*/);
  const cardName = nameMatch ? nameMatch[1] : null;

  // Extract series after "Series:"
  const seriesMatch = description.match(/Series:\s*([^\n]+)/);
  const seriesName = seriesMatch ? seriesMatch[1].trim() : null;

  // Validate all parts exist
  if (!cardName || !seriesName || !rarity) return null;

  return { cardName, seriesName, rarity };
}

function parseExpeditionEmbed(embed) {
  if (!embed || !embed.title || !embed.title.endsWith('s Expeditions')) return null;

  // More robust regex: handles any emoji/prefix or no prefix before the username.
  const usernameMatch = embed.title.match(/^(?:\S+\s)?(.+)'s Expeditions$/);
  if (!usernameMatch) return null;
  const username = usernameMatch[1];

  const cards = [];
  if (embed.fields) {
    for (const field of embed.fields) {
      const cardNameMatch = field.name.match(/>\s*([^|]+)/);
      const cardName = cardNameMatch ? cardNameMatch[1].trim() : 'Unknown Card';

      const cardIdMatch = field.value.match(/ID: (\d+)/);
      const timeMatch = field.value.match(/(?:⏳|\u23f3|⌛) \*\*(\d+h)?\s*(\d+m)?\s*(\d+s)? remaining\*\*/);

      if (cardIdMatch && timeMatch) {
        const cardId = cardIdMatch[1];
        let remainingMillis = 0;

        if (timeMatch[1]) remainingMillis += parseInt(timeMatch[1], 10) * 60 * 60 * 1000;
        if (timeMatch[2]) remainingMillis += parseInt(timeMatch[2], 10) * 60 * 1000;
        if (timeMatch[3]) remainingMillis += parseInt(timeMatch[3], 10) * 1000;
        else if (timeMatch[1] || timeMatch[2]) remainingMillis += 59 * 1000;

        if (remainingMillis > 0) cards.push({ cardId, cardName, remainingMillis });
      }
    }
  }

  return cards.length > 0 ? { username, cards } : null;
}

function parseRaidViewEmbed(embed) {
  if (!embed) return null;

  const partyMembersField = embed.fields?.find(f => f.name.includes('Party Members'));
  if (!partyMembersField) return null;

  const fatiguedUsers = [];
  const lines = partyMembersField.value.split('\n');

  for (const line of lines) {
    if (line.includes('Fatigued')) {
      const userIdMatch = line.match(/<@(\d+)>/);
      const timeContentMatch = line.match(/Fatigued \((.*)\)/);

      if (userIdMatch && timeContentMatch) {
        const userId = userIdMatch[1];
        const timeContent = timeContentMatch[1];

        let fatigueMillis = 0;
        const minutesMatch = timeContent.match(/(\d+)m/);
        const secondsMatch = timeContent.match(/(\d+)s/);

        if (minutesMatch) fatigueMillis += parseInt(minutesMatch[1], 10) * 60 * 1000;
        if (secondsMatch) fatigueMillis += parseInt(secondsMatch[1], 10) * 1000;

        if (fatigueMillis > 0) fatiguedUsers.push({ userId, fatigueMillis });
      }
    }
  }

  return fatiguedUsers.length > 0 ? fatiguedUsers : null;
}

module.exports = {
  parseBossEmbed,
  parseCardEmbed,
  parseExpeditionEmbed,
  parseRaidViewEmbed,
};
