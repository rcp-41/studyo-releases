# Studyo Agent Team

Bu klasör Studyo projesinin tamamlanması ve denetlenmesi için kurulmuş **subagent** ekibini içerir. Her `.md` dosyası bir agent tanımıdır (YAML frontmatter + sistem promptu).

## Kullanım

Claude Code içinde bir agent çağırmak için:
```
Agent({ subagent_type: "<agent-adı>", description: "...", prompt: "..." })
```
Örnek: `subagent_type: "security-auditor"`.

Aynı anda bağımsız agent'ları **paralel** çalıştırmak için tek mesajda birden çok `Agent` çağrısı yap.

## Build Agent'ları (kod yazar)
| Agent | Alan |
|---|---|
| `electron-desktop` | Electron main/preload, IPC, lisans, printer |
| `react-ui` | client/src React sayfaları & bileşenler |
| `firebase-backend` | Functions, Firestore rules/indexes, AppCheck |
| `whatsapp-bot` | Baileys WhatsApp entegrasyonu |
| `photo-ai` | photo-selector + face-api yüz tanıma |
| `i18n-l10n` | TR/EN çeviriler, locale formatları |
| `creator-panel` | creator_control_panel admin UI/server |
| `build-release` | electron-builder, auto-update, GH releases |
| `test-coverage` | Vitest + Playwright test altyapısı |
| `docs` | .md dokümantasyon güncelleme |

## Review Agent'ları (salt-okunur, rapor üretir)
| Agent | Alan |
|---|---|
| `security-auditor` | Secret sızıntısı, rules, IPC, XSS, OWASP |
| `code-quality` | Ölü kod, yedekler, sadeleştirme |
| `performance` | React render, Firestore maliyeti, bellek |

## Önerilen akış
1. **Faz 1 — Recon (paralel):** `security-auditor`, `code-quality`, `performance`.
2. **Faz 2 — Eksik tespiti:** Build agent'ları kendi alanını raporlasın.
3. **Faz 3 — Uygulama:** Önceliklendirilmiş işleri ilgili Build agent'ı yapsın.
4. **Faz 4 — Final review:** Review agent'ları değişiklikleri tekrar denetlesin.
