package main

import "fmt"

type Rectangle struct {
	Length float64
	Width  float64
}

func (r Rectangle) Area() float64 {
	return r.Length * r.Width
}

func (r *Rectangle) setLength(l float64) {
	r.Length = l

}

func main() {
	rect := Rectangle{Length: 20, Width: 30}
	fmt.Println(rect.Area())
	rect.setLength(50)

}
