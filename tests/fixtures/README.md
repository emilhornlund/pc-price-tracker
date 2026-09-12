# Prisjakt Fixtures

## `product-13438192.html`

This is a captured Prisjakt product-page response for:

```text
https://www.prisjakt.nu/produkt.php?p=13438192
```

The response is intentionally kept as HTML rather than reduced to a synthetic
fragment. The product page uses streamed Next.js markup, so the response
contains both rendered offer markup and serialized offer data. Removing the
script payload would remove the most complete representation of the offer
identifiers and prices.

### Observed product data

- Product title in the page `h1`:
  `Kingston FURY Beast RGB DDR5 Black 6000MHz 2x32GB CL30 (KF560C30BBEAK2-64)`
- The same title is present as `Product.name` in the JSON-LD block.
- The JSON-LD `AggregateOffer` contains the aggregate price range and count,
  but does not identify individual stores.

### Observed offers

The rendered page contains six representative elements with
`data-test="OfferListItem"`. Each contains an
`data-test="OfferClickoutButton"` link, a store logo `img[alt]`, and a price
heading. Prices use a non-breaking space as the thousands separator and `kr`
as the currency display.

| Store | Displayed price | Store ID | Offer ID |
| --- | ---: | ---: | --- |
| NetOnNet | 10 990 kr | 2 | 1049277 |
| Komplett.se | 13 557 kr | 33 | 1324197 |
| Webhallen | 13 599 kr | 113 | 374159 |
| CS MEGASTORE | 14 097 kr | 31588 | 20786297 |
| CDON | 14 097 kr | 429 | 05c68110-20b3-41d2-a09d-a2077a586d55 |
| Proshop | 14 815 kr | 12419 | 3252707 |

The store ID is stable independently of the display name. It is exposed as
`shopId` in the serialized `offerRows` data and is also the numeric segment in
the clickout URL:

```text
/go-to-shop/{shopId}/offer/{shopOfferId}
```

`shopOfferId` identifies the individual store offer and must not be used as
the store identity.

### Parser-facing observations

- Prefer the `h1` within the product page for the title and normalize its
  whitespace.
- Locate offers by `data-test="OfferListItem"`, not by generated CSS class
  names.
- Use the clickout URL and/or serialized `shopId` for the store identifier;
  use the logo `alt` text for the store name.
- Read the price from the offer's right-hand price heading. Do not use the
  aggregate JSON-LD price for an individual offer.
- The serialized offer rows contain `price.amount` and `price.currency`, which
  provide a numeric representation alongside the displayed price.
