"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"
import { apiClient } from "@/lib/api-client"
import type { Company } from "@/lib/types"

// 最近閲覧した企業の型
interface RecentCompany {
  docId: string
  companyName: string
  secCode: string | null
  viewedAt: number // timestamp
}

// LocalStorageキー
const STORAGE_KEYS = {
  FAVORITES: 'finrepo_favorites',
  RECENT: 'finrepo_recent',
} as const

// 最大履歴数
const MAX_RECENT_COMPANIES = 10

interface CompanyContextType {
  // 全データ
  allCompanies: Company[]
  // 利用可能な年度一覧（降順）
  fiscalYears: number[]
  // 選択中の年度
  selectedFiscalYear: number | null
  // 選択中の年度でフィルタされた企業一覧
  companies: Company[]
  // 選択中の企業
  selectedDocId: string
  selectedCompany: Company | null
  // 状態
  loading: boolean
  error: string | null
  // 最近閲覧・お気に入り
  recentlyViewed: RecentCompany[]
  favorites: string[] // doc_id の配列
  // アクション
  selectFiscalYear: (year: number) => void
  selectCompany: (docId: string) => void
  addToRecentlyViewed: (company: Company) => void
  toggleFavorite: (docId: string) => void
  isFavorite: (docId: string) => boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [allCompanies, setAllCompanies] = useState<Company[]>([])
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentlyViewed, setRecentlyViewed] = useState<RecentCompany[]>([])
  const [favorites, setFavorites] = useState<string[]>([])

  // LocalStorageから履歴とお気に入りを読み込む
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES)
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites))
      }

      const savedRecent = localStorage.getItem(STORAGE_KEYS.RECENT)
      if (savedRecent) {
        setRecentlyViewed(JSON.parse(savedRecent))
      }
    } catch (err) {
      console.error('Failed to load from localStorage:', err)
    }
  }, [])

  // 企業一覧を取得
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.getCompanies()
        setAllCompanies(response.companies)

        // 利用可能な年度を取得し、最新年度を選択
        const years = [...new Set(response.companies.map((c) => c.fiscal_year))]
          .filter((y): y is number => y !== null)
          .sort((a, b) => b - a)

        if (years.length > 0) {
          const latestYear = years[0]
          setSelectedFiscalYear(latestYear)

          // 最新年度の最初の企業を選択
          const companiesInYear = response.companies.filter((c) => c.fiscal_year === latestYear)
          if (companiesInYear.length > 0) {
            setSelectedDocId(companiesInYear[0].doc_id)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "企業一覧の取得に失敗しました")
        console.error("Failed to fetch companies:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()
  }, [])

  // 利用可能な年度一覧（降順）
  const fiscalYears = useMemo(() => {
    return [...new Set(allCompanies.map((c) => c.fiscal_year))]
      .filter((y): y is number => y !== null)
      .sort((a, b) => b - a)
  }, [allCompanies])

  // 選択年度でフィルタされた企業一覧
  const companies = useMemo(() => {
    if (selectedFiscalYear === null) return allCompanies
    return allCompanies.filter((c) => c.fiscal_year === selectedFiscalYear)
  }, [allCompanies, selectedFiscalYear])

  // 選択中の企業
  const selectedCompany = allCompanies.find((c) => c.doc_id === selectedDocId) || null

  // 年度選択（企業も再選択）
  const selectFiscalYear = (year: number) => {
    setSelectedFiscalYear(year)
    // その年度の最初の企業を選択
    const companiesInYear = allCompanies.filter((c) => c.fiscal_year === year)
    if (companiesInYear.length > 0) {
      setSelectedDocId(companiesInYear[0].doc_id)
    }
  }

  const selectCompany = (docId: string) => {
    setSelectedDocId(docId)
    // 選択された企業を最近閲覧に追加
    const company = allCompanies.find(c => c.doc_id === docId)
    if (company) {
      addToRecentlyViewed(company)
    }
  }

  // 最近閲覧に追加
  const addToRecentlyViewed = useCallback((company: Company) => {
    setRecentlyViewed(prev => {
      // 既存のエントリを削除（重複防止）
      const filtered = prev.filter(r => r.docId !== company.doc_id)

      // 新しいエントリを先頭に追加
      const newEntry: RecentCompany = {
        docId: company.doc_id,
        companyName: company.company_name,
        secCode: company.sec_code,
        viewedAt: Date.now(),
      }

      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_COMPANIES)

      // LocalStorageに保存
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(updated))
        } catch (err) {
          console.error('Failed to save recent to localStorage:', err)
        }
      }

      return updated
    })
  }, [])

  // お気に入りのトグル
  const toggleFavorite = useCallback((docId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(docId)
      const updated = isFav
        ? prev.filter(id => id !== docId)
        : [...prev, docId]

      // LocalStorageに保存
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated))
        } catch (err) {
          console.error('Failed to save favorites to localStorage:', err)
        }
      }

      return updated
    })
  }, [])

  // お気に入りかどうかを確認
  const isFavorite = useCallback((docId: string) => {
    return favorites.includes(docId)
  }, [favorites])

  return (
    <CompanyContext.Provider
      value={{
        allCompanies,
        fiscalYears,
        selectedFiscalYear,
        companies,
        selectedDocId,
        selectedCompany,
        loading,
        error,
        recentlyViewed,
        favorites,
        selectFiscalYear,
        selectCompany,
        addToRecentlyViewed,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider")
  }
  return context
}
