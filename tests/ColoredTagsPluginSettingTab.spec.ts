import { describe, it, expect, vi } from "vitest";
import { ColoredTagsPluginSettingTab } from "../src/ColoredTagsPluginSettingTab";
import { App } from "./__mocks__/obsidian";
import { DEFAULT_SETTINGS } from "../src/defaultSettings";
import {
	ColoredTagsPaletteType,
	ColoredTagsPluginSettings,
} from "../src/interfaces";
import {
	CommunityPalettesService,
	CommunityPalette,
} from "../src/CommunityPalettesService";
import { I18n } from "../src/i18n";

const basePalettes = {
	light: ["#ff0000", "#00ff00"],
	dark: ["#000000", "#111111"],
};

const createTab = (
	options: {
		palettes?: typeof basePalettes;
		settings?: Partial<ColoredTagsPluginSettings>;
		saveSettings?: ReturnType<typeof vi.fn>;
		saveData?: ReturnType<typeof vi.fn>;
	} = {},
	app = new App(),
) => {
	const plugin = {
		palettes: options.palettes ?? { ...basePalettes },
		settings: {
			...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
			...options.settings,
			palette: {
				...DEFAULT_SETTINGS.palette,
				...options.settings?.palette,
			},
			accessibility: {
				...DEFAULT_SETTINGS.accessibility,
				...options.settings?.accessibility,
			},
		},
		saveSettings: options.saveSettings ?? vi.fn(async () => {}),
		saveData: options.saveData ?? vi.fn(async () => {}),
		colorizeTag: vi.fn(),
	};
	return {
		app,
		plugin,
		tab: new ColoredTagsPluginSettingTab(app as any, plugin as any),
	};
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const findSetting = (container: HTMLElement, text: string) =>
	Array.from(container.querySelectorAll(".setting-item")).find(
		(s) =>
			s.querySelector(".setting-item-name")?.textContent?.includes(text),
	) as HTMLElement | undefined;

const renderSettingsTab = (tab: ColoredTagsPluginSettingTab) => {
	tab.update();
};

describe("ColoredTagsPluginSettingTab", () => {
	describe("rendering", () => {
		it("renders palette with correct number of color elements", () => {
			const { tab } = createTab({
				palettes: {
					light: ["#ff0000", "#00ff00", "#0000ff"],
					dark: ["#000", "#111"],
				},
			});
			const paletteEl = document.createElement("div");

			tab.renderPalette(paletteEl as any);

			expect(paletteEl.children).toHaveLength(3);
		});

		it("uses dark palette when dark theme is active", () => {
			const { tab } = createTab({
				palettes: { light: ["#fff"], dark: ["#0000ff", "#111111"] },
			});
			const paletteEl = document.createElement("div");
			const originalMatchMedia = window.matchMedia;
			window.matchMedia = () => ({ matches: true }) as any;

			tab.renderPalette(paletteEl as any);

			const children = paletteEl.querySelectorAll("div");
			expect(children).toHaveLength(2);
			expect(children[0].getAttribute("style")).toContain("#0000ff");

			window.matchMedia = originalMatchMedia;
		});

		it("falls back to light palette when active palette is empty", () => {
			const { tab } = createTab({
				palettes: { light: ["#abcabc"], dark: [] },
			});
			const paletteEl = document.createElement("div");
			const originalMatchMedia = window.matchMedia;
			window.matchMedia = () => ({ matches: true }) as any;

			tab.renderPalette(paletteEl as any);

			const hasLightColor = Array.from(
				paletteEl.querySelectorAll("div"),
			).some((child) => child.getAttribute("style")?.includes("#abcabc"));
			expect(hasLightColor).toBe(true);

			window.matchMedia = originalMatchMedia;
		});

		it("renders tags from metadataCache", () => {
			const { tab } = createTab();
			const container = document.createElement("div");

			tab.renderTags(container as any);

			expect(container.querySelectorAll("a.tag").length).toBeGreaterThan(
				0,
			);
		});

		it("renders nothing when no tags exist", () => {
			const app = new App();
			app.metadataCache.getTags = () => ({});
			const { tab } = createTab({}, app);
			const container = document.createElement("div");

			tab.renderTags(container as any);

			expect(container.querySelectorAll("a.tag")).toHaveLength(0);
		});

		it("displays custom palette input for custom palette type", () => {
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "ff0000-00ff00",
						seed: 0,
					},
				},
			});

			renderSettingsTab(tab);

			expect(
				tab.containerEl.querySelector(
					'input[placeholder="Paste palette"]',
				),
			).toBeTruthy();
		});

		it("animates palette preview when requested and animations are supported", () => {
			const { tab } = createTab({
				palettes: {
					light: ["#111111", "#222222"],
					dark: ["#333333"],
				},
			});
			const paletteEl = document.createElement("div");
			const animateSpy = vi.fn();
			(paletteEl as any).animate = animateSpy;

			tab.renderPalette(paletteEl as any, true);

			expect(animateSpy).toHaveBeenCalledWith(
				[{ opacity: 0.2 }, { opacity: 1 }],
				{ duration: 220, easing: "ease-out" },
			);
		});
	});

		it("renders custom palette description markup without innerHTML", () => {
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "ff0000-00ff00",
						seed: 0,
					},
				},
			});
			renderSettingsTab(tab);
			const code = tab.containerEl.querySelector(".setting-item-description code");
			expect(code).toBeTruthy();
			expect(code?.textContent).toBe("XXXXXX-XXXXXX-XXXXXX");
		});

		it("falls back to plain text when code markup is absent", () => {
			const { tab } = createTab();
			const container = document.createElement("div");
			(tab as any).renderCodeDescription(container, "plain description");
			expect(container.textContent).toBe("plain description");
			expect(container.querySelector("code")).toBeNull();
		});

		it("renders community discussion as the same external link", async () => {
			vi.spyOn(CommunityPalettesService, "getCommunityPalettes").mockResolvedValue([]);
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "ff0000-00ff00",
						seed: 0,
					},
				},
			});
			renderSettingsTab(tab);
			await tick();
			const link = tab.containerEl.querySelector<HTMLAnchorElement>(
				'.community-palettes__description a[href="https://github.com/pfrankov/obsidian-colored-tags/discussions/18"]',
			);
			expect(link).toBeTruthy();
			expect(link?.target).toBe("_blank");
		});

		it("falls back to plain text when community link tokens are absent", () => {
			const { tab } = createTab();
			const container = document.createElement("div");
			const original = I18n.t;
			vi.spyOn(I18n, "t").mockImplementation((key: string, params?: Record<string, string>) =>
				key === "settings.palette.custom.community.description"
					? "plain community description"
					: original.call(I18n, key, params),
			);
			(tab as any).renderCommunityDescription(container);
			expect(container.textContent).toBe("plain community description");
			expect(container.querySelector("a")).toBeNull();
			vi.restoreAllMocks();
		});

	describe("settings interactions", () => {
		it("toggles accessibility section and reveals High text contrast setting", async () => {
			const { tab } = createTab();
			tab.showAccessibility = false;
			renderSettingsTab(tab);

			const accessibilitySetting = findSetting(
				tab.containerEl,
				"Accessibility",
			);
			const toggle = accessibilitySetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			toggle.checked = true;
			toggle.dispatchEvent(new Event("change"));
			await tick();

			expect(tab.showAccessibility).toBe(true);
			expect(
				findSetting(tab.containerEl, "High text contrast"),
			).toBeTruthy();
		});

		it("toggles experimental section and reveals experimental controls", async () => {
			const { tab } = createTab();
			tab.showExperimental = false;
			renderSettingsTab(tab);

			const experimentalSetting = findSetting(
				tab.containerEl,
				"Experimental",
			);
			const toggle = experimentalSetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			toggle.checked = true;
			toggle.dispatchEvent(new Event("change"));
			await tick();

			expect(tab.showExperimental).toBe(true);
			expect(findSetting(tab.containerEl, "Mix colors")).toBeTruthy();
		});

		it("changes palette type via dropdown and triggers save", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			const container = document.createElement("div");
			const paletteEl = document.createElement("div");

			tab["renderPaletteSettings"](container as any, paletteEl as any);
			const select = container.querySelector(
				"select",
			) as HTMLSelectElement;
			select.value = String(ColoredTagsPaletteType.CUSTOM);
			select.dispatchEvent(new Event("change"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings.palette.selected).toBe(
				ColoredTagsPaletteType.CUSTOM,
			);
		});

		it("changes palette seed via slider and re-renders", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				palettes: {
					light: ["#ff0000", "#00ff00", "#0000ff"],
					dark: ["#000000"],
				},
				saveSettings,
			});
			tab.renderPalette = vi.fn();
			const container = document.createElement("div");
			const paletteEl = document.createElement("div");

			tab["renderPaletteSettings"](container as any, paletteEl as any);
			const slider = container.querySelector(
				'input[type="range"]',
			) as HTMLInputElement;
			slider.value = "2";
			slider.dispatchEvent(new Event("change"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(tab.renderPalette).toHaveBeenCalled();
			expect(plugin.settings.palette.seed).toBe(2);
		});

		it("validates custom palette input and saves only valid values", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			tab.renderPalette = vi.fn();
			const container = document.createElement("div");
			const paletteEl = document.createElement("div");

			tab["renderCustomPaletteField"](container as any, paletteEl as any);
			const input = container.querySelector(
				'input[placeholder="Paste palette"]',
			) as HTMLInputElement;

			input.value = "invalid-value";
			input.dispatchEvent(new Event("input"));
			await tick();
			expect(saveSettings).not.toHaveBeenCalled();

			input.value = "abcdef-123456";
			input.dispatchEvent(new Event("input"));
			await tick();
			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings.palette.custom).toBe("abcdef-123456");
		});

		it("toggles highTextContrast setting", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			tab.showAccessibility = true;
			renderSettingsTab(tab);

			const setting = findSetting(tab.containerEl, "High text contrast");
			const checkbox = setting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event("change"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings.accessibility.highTextContrast).toBe(true);
		});

		it("toggles experimental features (mix colors and transition)", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				settings: { mixColors: false, transition: false },
				saveSettings,
			});
			tab.showExperimental = true;
			renderSettingsTab(tab);

			const mixSetting = findSetting(tab.containerEl, "Mix colors");
			const mixToggle = mixSetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			mixToggle.checked = true;
			mixToggle.dispatchEvent(new Event("change"));
			await tick();
			expect(plugin.settings.mixColors).toBe(true);

			const transitionSetting = findSetting(
				tab.containerEl,
				"Gradient transition",
			);
			const transitionToggle = transitionSetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			transitionToggle.checked = true;
			transitionToggle.dispatchEvent(new Event("change"));
			await tick();
			expect(plugin.settings.transition).toBe(true);
			expect(saveSettings).toHaveBeenCalledTimes(2);

			expect(
				findSetting(tab.containerEl, "Tag assignments"),
			).toBeTruthy();
		});

		const chips = (tab: ColoredTagsPluginSettingTab) =>
			Array.from(
				tab.containerEl.querySelectorAll<HTMLElement>(
					".tag-color-setting__chip",
				),
			);
		const visibleTags = (tab: ColoredTagsPluginSettingTab) =>
			chips(tab)
				.filter(
					(chip) =>
						!chip.classList.contains("tag-color-setting__chip--hidden"),
				)
				.map((chip) => chip.dataset.tag);
		const chipFor = (tab: ColoredTagsPluginSettingTab, tag: string) =>
			chips(tab).find((chip) => chip.dataset.tag === tag)!;
		const clickChip = (tab: ColoredTagsPluginSettingTab, tag: string) => {
			const event = new Event("click", { cancelable: true });
			chipFor(tab, tag).querySelector("a.tag")!.dispatchEvent(event);
			return event;
		};
		const swatches = (tab: ColoredTagsPluginSettingTab) =>
			Array.from(
				tab.containerEl.querySelectorAll<HTMLButtonElement>(
					".tag-color-setting__swatch",
				),
			);
		const tagInput = (tab: ColoredTagsPluginSettingTab) =>
			tab.containerEl.querySelector(
				".tag-color-setting__input input",
			) as HTMLInputElement;

		it("shows every tag in use as a chip under the palette", () => {
			const { tab } = createTab();
			tab.showExperimental = true;
			renderSettingsTab(tab);

			expect(visibleTags(tab)).toEqual(["a", "a/b", "c"]);
			expect(chipFor(tab, "a").querySelector("a.tag")?.textContent).toBe(
				"#a",
			);
			expect(swatches(tab).every((swatch) => swatch.disabled)).toBe(true);
		});

		it("assigns a color by clicking a chip and then a swatch", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			tab.showExperimental = true;
			renderSettingsTab(tab);

			const event = clickChip(tab, "c");

			expect(event.defaultPrevented).toBe(true);
			expect(chipFor(tab, "c").classList.contains("is-selected")).toBe(
				true,
			);
			expect(visibleTags(tab)).toEqual(["a", "a/b", "c"]);
			expect(swatches(tab).some((swatch) => swatch.disabled)).toBe(false);

			swatches(tab)[1].dispatchEvent(new Event("click"));
			await tick();

			expect(plugin.settings.tagColors["c"]).toBe(1);
			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.colorizeTag).toHaveBeenCalledWith("c");
			expect(swatches(tab)[1].classList.contains("is-selected")).toBe(true);
			expect(swatches(tab)[0].classList.contains("is-selected")).toBe(
				false,
			);
			expect(chipFor(tab, "c").classList.contains("is-selected")).toBe(
				true,
			);
			expect(
				chipFor(tab, "c").querySelector(".tag-color-setting__chip-remove"),
			).toBeTruthy();
			expect(
				chipFor(tab, "a").querySelector(".tag-color-setting__chip-remove"),
			).toBeNull();
		});

		it("does not apply a color when no tag is selected", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab } = createTab({ saveSettings });
			tab.showExperimental = true;
			renderSettingsTab(tab);

			const swatch = swatches(tab)[0];
			swatch.disabled = false;
			swatch.dispatchEvent(new Event("click"));
			await tick();

			expect(saveSettings).not.toHaveBeenCalled();
		});

		it("filters chips and selects the typed tag", async () => {
			const { tab, plugin } = createTab();
			tab.showExperimental = true;
			renderSettingsTab(tab);

			const input = tagInput(tab);
			input.value = "#A";
			input.dispatchEvent(new Event("input"));

			expect(visibleTags(tab)).toEqual(["a", "a/b"]);

			swatches(tab)[0].dispatchEvent(new Event("click"));
			await tick();

			expect(plugin.settings.tagColors["a"]).toBe(0);
			expect(visibleTags(tab)).toEqual(["a", "a/b"]);

			input.value = "";
			input.dispatchEvent(new Event("input"));

			expect(visibleTags(tab)).toEqual(["a", "a/b", "c"]);
		});

		it("keeps tags that have a color but are no longer in use", () => {
			const { tab } = createTab({ settings: { tagColors: { old: 0 } } });
			tab.showExperimental = true;
			renderSettingsTab(tab);

			expect(visibleTags(tab)).toEqual(["a", "a/b", "c", "old"]);
		});

		it("shows empty state when the vault has no tags", () => {
			const app = new App();
			app.metadataCache.getTags = () => ({});
			const { tab } = createTab(
				{ settings: { tagColors: undefined as any } },
				app,
			);
			tab.showExperimental = true;
			renderSettingsTab(tab);

			expect(
				tab.containerEl.querySelector(".tag-color-setting__empty"),
			).toBeTruthy();
		});

		it("lists tags without colors when tagColors is missing", () => {
			const { tab } = createTab({
				settings: { tagColors: undefined as any },
			});
			tab.showExperimental = true;
			renderSettingsTab(tab);

			expect(visibleTags(tab)).toEqual(["a", "a/b", "c"]);
		});

		it("resets a tag color from its chip", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				saveSettings,
				settings: { tagColors: { a: 0 } },
			});
			tab.showExperimental = true;
			renderSettingsTab(tab);

			const removeBtn = chipFor(tab, "a").querySelector(
				".tag-color-setting__chip-remove",
			) as HTMLButtonElement;
			removeBtn.dispatchEvent(new Event("click", { cancelable: true }));
			await tick();

			expect(plugin.settings.tagColors).toEqual({});
			expect(saveSettings).toHaveBeenCalled();
			expect(
				chipFor(tab, "a").querySelector(".tag-color-setting__chip-remove"),
			).toBeNull();
			expect(visibleTags(tab)).toEqual(["a", "a/b", "c"]);
		});

		it("skips invalid tags and handles a missing metadata cache", () => {
			const app = new App();
			app.metadataCache.getTags = () => ({ "#keep": 1, "#/": 1 });
			const { tab } = createTab({}, app);
			tab.showExperimental = true;
			renderSettingsTab(tab);

			expect(visibleTags(tab)).toEqual(["keep"]);

			(app as any).metadataCache = undefined;
			expect((tab as any).collectTagsForAssignment()).toEqual([]);
		});

		it("refreshes the palette and chips when the palette changes", () => {
			const { tab, plugin } = createTab();
			tab.showExperimental = true;
			renderSettingsTab(tab);
			clickChip(tab, "a");

			plugin.palettes = {
				light: ["#ff0000", "#00ff00", "#0000ff"],
				dark: ["#000000", "#111111", "#222222"],
			};
			(tab as any).notifyPaletteChange();

			expect(swatches(tab).length).toBe(3);
			expect(chipFor(tab, "a").classList.contains("is-selected")).toBe(
				true,
			);
		});

		it("resets config to defaults", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				settings: { mixColors: false },
				saveSettings,
			});
			tab.showExperimental = true;
			renderSettingsTab(tab);

			const resetSetting = findSetting(tab.containerEl, "Reset config");
			const resetButton = resetSetting?.querySelector(
				"button",
			) as HTMLButtonElement;
			resetButton.dispatchEvent(new Event("click"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		});
	});

	describe("community palettes section", () => {
		it("renders palette cards, removes loading state, and applies palette on click", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "1-0",
					value: "aabbcc-ddeeff",
					colors: ["#aabbcc", "#ddeeff"],
					author: "alpha",
					score: 3,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				saveSettings,
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.renderPalette = vi.fn();
			renderSettingsTab(tab);
			await tick();

			const cards = tab.containerEl.querySelectorAll(
				".community-palette-card",
			);
			expect(cards).toHaveLength(1);
			expect(
				tab.containerEl.querySelector(".community-palettes__status"),
			).toBeNull();

			const customInput = tab.containerEl.querySelector(
				'input[placeholder="Paste palette"]',
			) as HTMLInputElement;
			(cards[0] as HTMLElement).dispatchEvent(new Event("click"));
			await tick();

			expect(plugin.settings.palette.custom).toBe("aabbcc-ddeeff");
			expect(customInput.value).toBe("aabbcc-ddeeff");
			expect(saveSettings).toHaveBeenCalled();
			expect(tab.renderPalette).toHaveBeenLastCalledWith(
				expect.any(HTMLElement),
				true,
			);
			expect(cards[0].classList.contains("is-selected")).toBe(true);
			expect(cards[0].getAttribute("aria-pressed")).toBe("true");
			getPalettesSpy.mockRestore();
		});

		it("applies community palette via keyboard interaction", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "1-0",
					value: "111111-222222",
					colors: ["#111111", "#222222"],
					author: "alpha",
					score: 3,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const { tab, plugin } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.renderPalette = vi.fn();
			renderSettingsTab(tab);
			await tick();

			const card = tab.containerEl.querySelector(
				".community-palette-card",
			) as HTMLElement;
			const event = new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
				cancelable: true,
			});
			card.dispatchEvent(event);
			await tick();

			expect(plugin.settings.palette.custom).toBe("111111-222222");
			expect(card.classList.contains("is-selected")).toBe(true);

			const spaceEvent = new KeyboardEvent("keydown", {
				key: " ",
				bubbles: true,
				cancelable: true,
			});
			card.dispatchEvent(spaceEvent);
			await tick();

			expect(plugin.settings.palette.custom).toBe("111111-222222");
			getPalettesSpy.mockRestore();
		});

		it("auto-selects community palette when custom value matches and clears selection when palette changes", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "match-1",
					value: "aabbcc-ddeeff",
					colors: ["#aabbcc", "#ddeeff"],
					author: "alpha",
					score: 5,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "AABBCC-DDEEFF",
						seed: 0,
					},
				},
			});
			renderSettingsTab(tab);
			await tick();

			const card = tab.containerEl.querySelector(
				".community-palette-card",
			) as HTMLElement;
			const input = tab.containerEl.querySelector(
				'input[placeholder="Paste palette"]',
			) as HTMLInputElement;
			expect(card.classList.contains("is-selected")).toBe(true);
			expect(card.getAttribute("aria-pressed")).toBe("true");

			input.value = "ffeeaa-ccbbaa";
			input.dispatchEvent(new Event("input"));
			await tick();

			expect(card.classList.contains("is-selected")).toBe(false);
			expect(card.getAttribute("aria-pressed")).toBe("false");

			input.value = "aabbcc-ddeeff";
			input.dispatchEvent(new Event("input"));
			await tick();

			expect(card.classList.contains("is-selected")).toBe(true);
			getPalettesSpy.mockRestore();
		});

		it("switches selected state when applying a different community palette", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "1-0",
					value: "111111-222222",
					colors: ["#111111", "#222222"],
					author: "one",
					score: 2,
				},
				{
					id: "2-0",
					value: "333333-444444",
					colors: ["#333333", "#444444"],
					author: "two",
					score: 4,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const { tab } = createTab({
				saveSettings: vi.fn(async () => {}),
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			renderSettingsTab(tab);
			await tick();

			const cards = Array.from(
				tab.containerEl.querySelectorAll(".community-palette-card"),
			) as HTMLElement[];
			cards[0].dispatchEvent(new Event("click"));
			await tick();
			expect(cards[0].classList.contains("is-selected")).toBe(true);
			expect(cards[1].classList.contains("is-selected")).toBe(false);

			cards[1].dispatchEvent(new Event("click"));
			await tick();
			expect(cards[0].classList.contains("is-selected")).toBe(false);
			expect(cards[1].classList.contains("is-selected")).toBe(true);
			getPalettesSpy.mockRestore();
		});

		it("clears community palette selection when custom palette is not active", () => {
			const { tab } = createTab();
			const card = document.createElement("div");
			(tab as any).communityPaletteCards.set("value", card);

			(tab as any).updateCommunityPaletteSelection();

			expect(card.classList.contains("is-selected")).toBe(false);
			expect(card.getAttribute("aria-pressed")).toBe("false");
		});

		it("shows empty state when no community palettes are available", async () => {
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue([]);
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			renderSettingsTab(tab);
			await tick();

			const statusEl = tab.containerEl.querySelector(
				".community-palettes__status",
			) as HTMLElement;
			expect(statusEl.textContent).toBe(
				I18n.t("settings.palette.custom.community.empty"),
			);
			getPalettesSpy.mockRestore();
		});

		it("shows error message when community palettes fetch fails", async () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockRejectedValue(new Error("network"));
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			renderSettingsTab(tab);
			await tick();

			const statusEl = tab.containerEl.querySelector(
				".community-palettes__status",
			) as HTMLElement;
			expect(statusEl.textContent).toBe(
				I18n.t("settings.palette.custom.community.error"),
			);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
			getPalettesSpy.mockRestore();
		});
	});
});
