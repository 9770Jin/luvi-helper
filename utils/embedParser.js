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

function parseBossComponent(components) {
  if (!components || !components.length) return null;
  const root = components[0];
  if (root.type !== 17) return null;

  let bossName = null;
  let tier = null;

  for (const comp of root.components) {
    if (comp.type === 10) {
      if (comp.id === 2) {
        bossName = comp.content.replace(/\*\*/g, '').trim();
      }
      if (comp.id === 3) {
        const tierMatch = comp.content.match(/<:LU_Tier(\d+):\d+>/);
        if (tierMatch) {
          tier = `Tier ${tierMatch[1]}`;
        }
      }
    }
  }

  return (bossName && tier) ? { bossName, tier } : null;
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

function parseExpeditionComponent(components) {
  if (!components || !components.length) return null;
  const root = components[0];
  if (root.type !== 17) return null;

  let username = null;
  const cards = [];

  for (const comp of root.components) {
    if (comp.type === 10 && comp.id === 2) {
      const usernameMatch = comp.content.match(/^(.+)'s Expeditions$/);
      if (usernameMatch) username = usernameMatch[1];

      if (comp.content === "**Expedition Resend Results**") {
        return { isResend: true };
      }
    }

    if (comp.type === 9) {
      const cardTextComp = comp.components.find(c => c.type === 10);
      if (cardTextComp) {
        const content = cardTextComp.content;
        const cardNameMatch = content.match(/<:LU_[ELR]:\d+>\s*(.+)/);
        const cardName = cardNameMatch ? cardNameMatch[1].split('\n')[0].trim() : 'Unknown Card';

        const cardIdMatch = content.match(/ID: (\d+)/);
        const timeMatch = content.match(/(?:⏳|\u23f3|⌛)\s*(\d+h)?\s*(\d+m)?\s*(\d+s)? remaining/);

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
  }

  if (username && cards.length > 0) return { username, cards };
  return null;
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

function parseRaidViewComponent(components) {
  if (!components || !components.length) return null;
  const root = components[0];
  if (root.type !== 17) return null;

  const partyMembersComp = root.components.find(c => c.type === 10 && c.content.includes('Party Members'));
  if (!partyMembersComp) return null;

  const fatiguedUsers = [];
  const lines = partyMembersComp.content.split('\n');

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
  parseBossComponent,
  parseExpeditionEmbed,
  parseExpeditionComponent,
  parseRaidViewEmbed,
  parseRaidViewComponent,
};
